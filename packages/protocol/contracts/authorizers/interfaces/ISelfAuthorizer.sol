// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IAuthorizer.sol";

interface ISelfAuthorizer is IAuthorizer {
    event AdminParametersSet(
        bytes32 indexed providerId,
        address indexed adminAddress,
        bool status,
        uint256 maxWhitelistExtension
        );
    event AdminshipRenounced(
        bytes32 indexed providerId,
        address indexed adminAddress
        );
    event ClientWhitelistingForProviderExtended(
        bytes32 indexed providerId,
        address indexed clientAddress,
        uint256 whitelistExpiration,
        address indexed adminAddress
        );
    event RequesterWhitelistingForProviderExtended(
        bytes32 indexed providerId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration,
        address indexed adminAddress
        );
    event ClientWhitelistExpirationSet(
        bytes32 indexed providerId,
        address indexed clientAddress,
        uint256 whitelistExpiration
        );
    event RequesterWhitelistExpirationSet(
        bytes32 indexed providerId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration
        );

    function setAdminParameters(
        bytes32 providerId,
        address adminAddress,
        bool status,
        uint256 maxWhitelistExtension
        )
        external;

    function renounceAdminship(bytes32 providerId)
        external;

    function extendClientWhitelistingForProvider(
        bytes32 providerId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external;

    function extendRequesterWhitelistingForProvider(
        bytes32 providerId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external;

    function setClientWhitelistExpirationForProvider(
        bytes32 providerId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external;

    function setRequesterWhitelistExpirationForProvider(
        bytes32 providerId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external;
}
