// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

/// @title  Guestbook
/// @notice A public wall that anyone can sign. Each signature is permanent, publicly readable, and owned by the
///         wallet that wrote it — nobody can edit or delete another person's entry, and there is no admin who can
///         wipe the wall. That last part is deliberate: the demo practices the "no upgrade key can override you"
///         property the talk claims a sovereign chain has.
/// @dev    Deployed live to the Avalanche Fuji testnet. The frontend reads `getEntries` for the feed and watches
///         the `Signed` event for live updates; both are cheap enough that the demo needs no indexer.
contract Guestbook {
    ////////////////////////////////////////////////////////////////////////////
    //                                STORAGE                                 //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice A single signature on the wall.
    /// @param signer    The wallet that signed — this is the "ownership" bit.
    /// @param message   The text they left.
    /// @param timestamp Block time (seconds) when it was recorded.
    struct Entry {
        address signer;
        string message;
        uint256 timestamp;
    }

    /// @dev The wall itself. Private so reads go through the paginated `getEntries`, which keeps a large wall from
    ///      being returned in a single unbounded call.
    Entry[] private entries;

    /// @notice Longest message accepted. Bounds gas per `sign` and keeps the feed readable on screen.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    ////////////////////////////////////////////////////////////////////////////
    //                                 EVENTS                                 //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Emitted on every signature so the frontend can append to the feed without re-reading the whole wall.
    event Signed(address indexed signer, string message, uint256 timestamp);

    /// @notice Raised when a message is empty or longer than {MAX_MESSAGE_LENGTH}.
    error InvalidMessageLength();

    ////////////////////////////////////////////////////////////////////////////
    //                        STATE-CHANGING FUNCTIONS                        //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Sign the guestbook. One call records one permanent, publicly-owned entry.
    /// @param message The text to leave on the wall (1..{MAX_MESSAGE_LENGTH} bytes).
    function sign(string calldata message) external {
        uint256 length = bytes(message).length;
        if (length == 0 || length > MAX_MESSAGE_LENGTH) revert InvalidMessageLength();

        entries.push(Entry({signer: msg.sender, message: message, timestamp: block.timestamp}));

        emit Signed(msg.sender, message, block.timestamp);
    }

    ////////////////////////////////////////////////////////////////////////////
    //                          READ-ONLY FUNCTIONS                           //
    ////////////////////////////////////////////////////////////////////////////

    /// @notice Total number of signatures. Drives the on-screen counter.
    function total() external view returns (uint256) {
        return entries.length;
    }

    /// @notice Read a slice of the wall, newest-first, for the live feed.
    /// @dev    Returns up to `limit` entries starting `offset` positions back from the newest. Paginating keeps the
    ///         call cheap and bounded no matter how large the wall grows.
    /// @param offset How many of the most-recent entries to skip (0 = start at the newest).
    /// @param limit  Maximum number of entries to return.
    /// @return page  The requested entries, ordered newest-first.
    function getEntries(uint256 offset, uint256 limit) external view returns (Entry[] memory page) {
        uint256 count = entries.length;
        if (offset >= count || limit == 0) return new Entry[](0);

        // How many entries actually remain after skipping `offset` from the newest end.
        uint256 remaining = count - offset;
        uint256 size = remaining < limit ? remaining : limit;

        page = new Entry[](size);
        for (uint256 i = 0; i < size; i++) {
            // Newest-first: index (count - 1 - offset) walks backwards through storage.
            page[i] = entries[count - 1 - offset - i];
        }
    }
}
