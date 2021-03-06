import * as fixtures from 'test/fixtures';
import * as aggregation from './aggregation';
import { RequestStatus } from 'src/types';

describe('aggregate (API calls)', () => {
  it('ignores requests that are not pending', () => {
    const apiCalls = [
      fixtures.requests.buildApiCall({ status: RequestStatus.Errored }),
      fixtures.requests.buildApiCall({ status: RequestStatus.Ignored }),
      fixtures.requests.buildApiCall({ status: RequestStatus.Blocked }),
      fixtures.requests.buildApiCall({ status: RequestStatus.Fulfilled }),
    ];
    const res = aggregation.aggregate(fixtures.buildConfig(), apiCalls);
    expect(res).toEqual({});
  });

  it('groups calls if they have the exact same attributes', () => {
    const endpointId = '0x3c8e59646e688707ddd3b1f07c4dbc5ab55a0257362a18569ac2644ccf6faddb';
    const apiCalls = [
      fixtures.requests.buildApiCall({ endpointId }),
      fixtures.requests.buildApiCall({ endpointId }),
      fixtures.requests.buildApiCall({ endpointId }),
    ];
    const res = aggregation.aggregate(fixtures.buildConfig(), apiCalls);
    expect(res).toEqual({
      apiCallId: {
        endpointId: '0x3c8e59646e688707ddd3b1f07c4dbc5ab55a0257362a18569ac2644ccf6faddb',
        endpointName: 'convertToUSD',
        id: 'apiCallId',
        oisTitle: 'currency-converter-ois',
        parameters: { from: 'ETH' },
        type: 'request',
      },
    });
  });

  it('groups calls if they have they different attributes unrelated to the API call', () => {
    const endpointId = '0x3c8e59646e688707ddd3b1f07c4dbc5ab55a0257362a18569ac2644ccf6faddb';
    const apiCalls = [
      fixtures.requests.buildApiCall({ endpointId, fulfillAddress: '0x123' }),
      fixtures.requests.buildApiCall({ endpointId, fulfillAddress: '0x456' }),
    ];
    const res = aggregation.aggregate(fixtures.buildConfig(), apiCalls);
    expect(res).toEqual({
      apiCallId: {
        endpointId: '0x3c8e59646e688707ddd3b1f07c4dbc5ab55a0257362a18569ac2644ccf6faddb',
        endpointName: 'convertToUSD',
        id: 'apiCallId',
        oisTitle: 'currency-converter-ois',
        parameters: { from: 'ETH' },
        type: 'request',
      },
    });
  });
});
