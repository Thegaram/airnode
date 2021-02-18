// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./IAuthorizer.sol";

interface IMasterAuthorizer is IAuthorizer {
    event MasterAdminshipTransferred(
        address previousMasterAdmin,
        address newMasterAdmin
        );
    event AdminParametersSet(
        address indexed adminAddress,
        bool status,
        uint256 maxWhitelistExtension
        );
    event AdminshipRenounced(address indexed adminAddress);
    event ClientWhitelistingForProviderExtended(
        bytes32 indexed providerId,
        address indexed clientAddress,
        uint256 whitelistExpiration,
        address adminAddress
        );
    event RequesterWhitelistingForProviderExtended(
        bytes32 indexed providerId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration,
        address adminAddress
        );
    event ClientWhitelistingForEndpointExtended(
        bytes32 indexed providerId,
        bytes32 indexed endpointId,
        address indexed clientAddress,
        uint256 whitelistExpiration,
        address adminAddress
        );
    event RequesterWhitelistingForEndpointExtended(
        bytes32 indexed providerId,
        bytes32 indexed endpointId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration,
        address adminAddress
        );
    event ClientWhitelistForProviderExpirationSet(
        bytes32 indexed providerId,
        address indexed clientAddress,
        uint256 whitelistExpiration
        );
    event RequesterWhitelistForProviderExpirationSet(
        bytes32 indexed providerId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration
        );
    event ClientWhitelistForEndpointExpirationSet(
        bytes32 indexed providerId,
        bytes32 indexed endpointId,
        address indexed clientAddress,
        uint256 whitelistExpiration
        );
    event RequesterWhitelistForEndpointExpirationSet(
        bytes32 indexed providerId,
        bytes32 indexed endpointId,
        uint256 indexed requesterIndex,
        uint256 whitelistExpiration
        );

    function transferMasterAdminship(address _masterAdmin)
        external;

    function setAdminParameters(
        address adminAddress,
        bool status,
        uint256 maxWhitelistExtension
        )
        external;

    function renounceAdminship()
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

    function extendClientWhitelistingForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external;

    function extendRequesterWhitelistingForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
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

    function setClientWhitelistExpirationForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        address clientAddress,
        uint256 whitelistExpiration
        )
        external;

    function setRequesterWhitelistExpirationForEndpoint(
        bytes32 providerId,
        bytes32 endpointId,
        uint256 requesterIndex,
        uint256 whitelistExpiration
        )
        external;
}
