// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title  NaiveAuction — step 1 of 2, deliberately broken
/// @notice A sealed-bid auction the obvious way: every bidder submits one secret offer, the highest wins. This is
///         how a first attempt almost always looks, and it does not work. The bids are stored in a `private`
///         mapping, which stops *other contracts* reading them and stops nobody else. Anyone with an RPC endpoint
///         can read every bid straight out of storage and then bid one wei more.
/// @dev    Do not copy this. It exists to be attacked on stage. `sealedBid` is deliberately the first declared
///         storage variable, so its slot index is 0 and the live attack is a two-command demo:
///
///             cast index address <bidder> 0        # -> storage slot holding that bidder's "secret"
///             cast storage <auction> <slot>        # -> the bid, in the clear
contract NaiveAuction {
    ////////////////////////////////////////////////////////////////////////////
    //                               IMMUTABLES                               //
    ////////////////////////////////////////////////////////////////////////////

    // Immutables are written into the contract's bytecode at construction, not into storage. They therefore
    // occupy no storage slot, which is why declaring them above `sealedBid` leaves that mapping at slot 0.

    /// @notice Who is selling.
    address public immutable seller;

    /// @notice Bidding closes at this timestamp. After it, {winner} can be called.
    uint256 public immutable closesAt;

    ////////////////////////////////////////////////////////////////////////////
    //                                STORAGE                                 //
    ////////////////////////////////////////////////////////////////////////////

    /// @dev Slot 0, being the first declared storage variable. The word "private" here is the entire lesson: it
    ///      is a compile-time visibility rule, not encryption. Every value in this mapping is world-readable.
    mapping(address bidder => uint256 amountInWei) private sealedBid;

    /// @dev Slot 1. Kept so {winner} can iterate; a real auction would not need it.
    address[] private bidders;

    ////////////////////////////////////////////////////////////////////////////
    //                           EVENTS AND ERRORS                            //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Emitted on every bid. Note it deliberately does not log the amount — which buys us nothing at all,
    ///         as the attack demonstrates.
    event BidSubmitted(address indexed bidder);

    error BiddingClosed();
    error BiddingStillOpen();
    error AlreadyBid();
    error ZeroBid();

    ////////////////////////////////////////////////////////////////////////////
    //                              CONSTRUCTOR                               //
    ////////////////////////////////////////////////////////////////////////////

    /// @param biddingSeconds How long bidding stays open, in seconds.
    constructor(uint256 biddingSeconds) {
        seller = msg.sender;
        closesAt = block.timestamp + biddingSeconds;
    }

    ////////////////////////////////////////////////////////////////////////////
    //                        STATE-CHANGING FUNCTIONS                        //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Submit a sealed bid. One per address.
    /// @param amount The offer, in wei. No money moves yet — this is a promise to pay.
    function submitBid(uint256 amount) external {
        if (block.timestamp >= closesAt) revert BiddingClosed();
        if (amount == 0) revert ZeroBid();
        if (sealedBid[msg.sender] != 0) revert AlreadyBid();

        sealedBid[msg.sender] = amount;
        bidders.push(msg.sender);

        emit BidSubmitted(msg.sender);
    }

    ////////////////////////////////////////////////////////////////////////////
    //                          READ-ONLY FUNCTIONS                           //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice The winning bidder and their offer, once bidding has closed.
    /// @return winningBidder The highest bidder, or the zero address if nobody bid.
    /// @return winningAmount Their offer, in wei.
    function winner() external view returns (address winningBidder, uint256 winningAmount) {
        if (block.timestamp < closesAt) revert BiddingStillOpen();

        uint256 count = bidders.length;
        for (uint256 i = 0; i < count; i++) {
            address bidder = bidders[i];
            uint256 offer = sealedBid[bidder];
            if (offer > winningAmount) {
                winningAmount = offer;
                winningBidder = bidder;
            }
        }
    }

    /// @notice How many bids have been submitted.
    function bidderCount() external view returns (uint256) {
        return bidders.length;
    }
}
