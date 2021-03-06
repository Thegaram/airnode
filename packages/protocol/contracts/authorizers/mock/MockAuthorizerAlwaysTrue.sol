// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../interfaces/IAuthorizer.sol";

/// @title A mock authorizer that always returns true
contract MockAuthorizerAlwaysTrue is IAuthorizer {
    function checkIfAuthorized(
        bytes32 requestId, // solhint-disable-line
        bytes32 providerId, // solhint-disable-line
        bytes32 endpointId, // solhint-disable-line
        uint256 requesterIndex, // solhint-disable-line
        address designatedWallet, // solhint-disable-line
        address clientAddress // solhint-disable-line
        )
        virtual
        external
        view
        override
        returns (bool status)
    {
        status = true;
    }
}
