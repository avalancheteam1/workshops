// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title  SealedBidAuction — step 2 of 2, the version you would actually ship
/// @notice A first-price sealed-bid auction: every bidder submits one hidden offer, the highest wins and pays
///         what they bid. This is the structure behind Scottish property sales, government tenders and spectrum
///         licences — one shot, no visible competition, no bidding war.
/// @dev    Closes the hole step 1 opened, and the two more that a naive fix opens:
///
///         1. Bids are committed as a hash, so storage discloses nothing while bidding is open.
///         2. Committing costs a deposit, forfeited to the seller if you never reveal. Silence is no longer free,
///            which is what makes the revealed set match the committed set.
///         3. The commitment is bound to `msg.sender`, so a copied commitment is worthless to the copier.
///
///         Money moves by pull, never push: every refund is credited to a balance the owner withdraws themselves.
///         A push refund lets one bidder with a reverting `receive()` wedge the whole auction.
///
///         The phase checks compare against `block.timestamp`, which a validator can nudge by a few seconds. That
///         is deliberate and safe here: phases run for minutes or hours, so a second either way cannot move a bid
///         between them. Never reach for this pattern where the window is comparable to the drift.
///
///         There is no `receive` or `fallback` on purpose — a plain transfer to this contract reverts, so money
///         can only enter through {commit} and {reveal}, where it is accounted for.
contract SealedBidAuction {
    ////////////////////////////////////////////////////////////////////////////
    //                                CONSTANTS                               //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice What each bidder must stake to commit, and lose if they never reveal.
    uint256 public constant DEPOSIT = 0.01 ether;

    ////////////////////////////////////////////////////////////////////////////
    //                               IMMUTABLES                               //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Who is selling.
    address public immutable seller;

    /// @notice Commitments accepted until this timestamp.
    uint256 public immutable commitDeadline;

    /// @notice Reveals accepted from {commitDeadline} until this timestamp.
    uint256 public immutable revealDeadline;

    ////////////////////////////////////////////////////////////////////////////
    //                                STORAGE                                 //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Each bidder's commitment: keccak256(abi.encode(bidder, amount, salt)).
    mapping(address bidder => bytes32 commitment) public commitmentOf;

    /// @notice Whether a bidder has revealed a valid bid.
    mapping(address bidder => bool revealed) public hasRevealed;

    /// @notice Withdrawable balances. Losing bids, returned deposits and the seller's proceeds all land here.
    mapping(address claimant => uint256 owedInWei) public refunds;

    /// @notice Leader so far, among bidders who have revealed.
    address public highestBidder;

    /// @notice The leading bid, in wei. Stays escrowed in this contract until {finalise}.
    uint256 public highestBid;

    /// @notice Set once {finalise} has credited the seller, so proceeds cannot be credited twice.
    bool public finalised;

    ////////////////////////////////////////////////////////////////////////////
    //                           EVENTS AND ERRORS                            //
    ////////////////////////////////////////////////////////////////////////////

    event Committed(address indexed bidder, bytes32 commitment);
    event Revealed(address indexed bidder, uint256 amount);
    event DepositForfeited(address indexed bidder, uint256 amount);
    event Finalised(address indexed winner, uint256 amount);
    event Withdrawn(address indexed who, uint256 amount);

    error CommitPhaseOver();
    error NotInRevealPhase();
    error RevealPhaseOver();
    error StillRunning();
    error AlreadyCommitted();
    error NothingCommitted();
    error AlreadyRevealed();
    error AlreadyFinalised();
    error BadReveal();
    error WrongDeposit(uint256 sent, uint256 required);
    error WrongPayment(uint256 sent, uint256 declared);
    error ZeroBid();
    error NothingToWithdraw();
    error TransferFailed();

    ////////////////////////////////////////////////////////////////////////////
    //                              CONSTRUCTOR                               //
    ////////////////////////////////////////////////////////////////////////////

    /// @param commitSeconds How long commitments are accepted.
    /// @param revealSeconds How long reveals are accepted, after commitments close.
    constructor(uint256 commitSeconds, uint256 revealSeconds) {
        seller = msg.sender;
        commitDeadline = block.timestamp + commitSeconds;
        revealDeadline = commitDeadline + revealSeconds;
    }

    ////////////////////////////////////////////////////////////////////////////
    //                        STATE-CHANGING FUNCTIONS                        //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Commit to a bid without disclosing it, staking {DEPOSIT} on the promise to reveal it later.
    /// @param commitment keccak256(abi.encode(yourAddress, amount, salt)). Keep the salt: without it you cannot
    ///        reveal, and the deposit is lost.
    function commit(bytes32 commitment) external payable {
        if (block.timestamp >= commitDeadline) revert CommitPhaseOver();
        if (msg.value != DEPOSIT) revert WrongDeposit(msg.value, DEPOSIT);
        if (commitmentOf[msg.sender] != bytes32(0)) revert AlreadyCommitted();

        commitmentOf[msg.sender] = commitment;

        emit Committed(msg.sender, commitment);
    }

    /// @notice Prove what you committed to, and pay the bid into escrow.
    /// @dev    The deposit is credited straight back — it only ever existed to make silence expensive. A losing
    ///         bid is credited back immediately too; only the current leader's money stays escrowed.
    /// @param amount The bid, in wei. Must equal `msg.value`.
    /// @param salt   The salt used when committing.
    function reveal(uint256 amount, bytes32 salt) external payable {
        if (block.timestamp < commitDeadline) revert NotInRevealPhase();
        if (block.timestamp >= revealDeadline) revert RevealPhaseOver();
        if (amount == 0) revert ZeroBid();
        if (msg.value != amount) revert WrongPayment(msg.value, amount);

        bytes32 commitment = commitmentOf[msg.sender];
        if (commitment == bytes32(0)) revert NothingCommitted();
        if (hasRevealed[msg.sender]) revert AlreadyRevealed();
        // Binding the hash to msg.sender is what makes a copied commitment worthless to the copier.
        if (commitment != keccak256(abi.encode(msg.sender, amount, salt))) revert BadReveal();

        hasRevealed[msg.sender] = true;
        refunds[msg.sender] += DEPOSIT;

        if (amount > highestBid) {
            // The outgoing leader gets their escrowed bid back.
            if (highestBidder != address(0)) refunds[highestBidder] += highestBid;
            highestBid = amount;
            highestBidder = msg.sender;
        } else {
            // Already beaten, so this bid never needs to stay escrowed.
            refunds[msg.sender] += amount;
        }

        emit Revealed(msg.sender, amount);
    }

    /// @notice Take the deposit off a bidder who committed and never revealed, crediting it to the seller.
    /// @dev    Callable by anyone once revealing has closed — it costs the caller gas and pays them nothing, but
    ///         leaving it permissionless means the seller does not depend on any single party showing up.
    /// @param bidder The silent bidder.
    function sweepDeposit(address bidder) external {
        if (block.timestamp < revealDeadline) revert StillRunning();
        if (commitmentOf[bidder] == bytes32(0)) revert NothingCommitted();
        if (hasRevealed[bidder]) revert AlreadyRevealed();

        // Clearing the commitment is what makes this callable only once per bidder.
        commitmentOf[bidder] = bytes32(0);
        refunds[seller] += DEPOSIT;

        emit DepositForfeited(bidder, DEPOSIT);
    }

    /// @notice Close the auction and credit the winning bid to the seller.
    function finalise() external {
        if (block.timestamp < revealDeadline) revert StillRunning();
        if (finalised) revert AlreadyFinalised();

        finalised = true;
        refunds[seller] += highestBid;

        emit Finalised(highestBidder, highestBid);
    }

    /// @notice Withdraw everything owed to you.
    /// @dev    Balance is zeroed before the call, so a re-entering receiver finds nothing left to claim.
    function withdraw() external {
        uint256 amount = refunds[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        refunds[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    ////////////////////////////////////////////////////////////////////////////
    //                          READ-ONLY FUNCTIONS                           //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Helper so bidders can build a commitment without getting the encoding wrong.
    /// @dev    A `pure` helper, so calling it is a local RPC read and never discloses the inputs on chain. Never
    ///         call this through a transaction — that would put the bid and salt in public calldata.
    function commitmentFor(address bidder, uint256 amount, bytes32 salt) external pure returns (bytes32) {
        return keccak256(abi.encode(bidder, amount, salt));
    }
}
