import { ethers } from 'ethers';
import chunk from 'lodash/chunk';
import flatMap from 'lodash/flatMap';
import keyBy from 'lodash/keyBy';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { go, retryOperation } from '../../utils/promise-utils';
import * as logger from '../../logger';
import { Airnode } from '../contracts';
import { ApiCall, ApiCallTemplate, ClientRequest, LogsData } from '../../types';
import { OPERATION_RETRIES, CONVENIENCE_BATCH_SIZE } from '../../constants';

export interface FetchOptions {
  airnodeAddress: string;
  provider: ethers.providers.JsonRpcProvider;
}

interface ApiCallTemplatesById {
  [id: string]: ApiCallTemplate;
}

export async function fetchTemplate(
  airnode: ethers.Contract,
  templateId: string
): Promise<LogsData<ApiCallTemplate | null>> {
  const contractCall = () => airnode.getTemplate(templateId) as Promise<any>;
  const retryableContractCall = retryOperation(OPERATION_RETRIES, contractCall);

  const [err, rawTemplate] = await go(retryableContractCall);
  if (err || !rawTemplate) {
    const log = logger.pend('ERROR', `Failed to fetch API call template:${templateId}`, err);
    return [[log], null];
  }

  const successLog = logger.pend('INFO', `Fetched API call template:${templateId}`);

  const template: ApiCallTemplate = {
    encodedParameters: rawTemplate.parameters,
    endpointId: rawTemplate.endpointId,
    id: templateId,
    providerId: rawTemplate.providerId,
  };
  return [[successLog], template];
}

async function fetchTemplateGroup(
  airnode: ethers.Contract,
  templateIds: string[]
): Promise<LogsData<ApiCallTemplatesById>> {
  const contractCall = () => airnode.getTemplates(templateIds) as Promise<any>;
  const retryableContractCall = retryOperation(OPERATION_RETRIES, contractCall);

  const [err, rawTemplates] = await go(retryableContractCall);
  // If we fail to fetch templates, the linked requests will be discarded and retried
  // on the next run
  if (err || !rawTemplates) {
    const groupLog = logger.pend('ERROR', 'Failed to fetch API call templates', err);

    // If the template group cannot be fetched, fallback to fetching templates individually
    const promises = templateIds.map((id) => fetchTemplate(airnode, id));
    const logsWithTemplates = await Promise.all(promises);
    const individualLogs = flatMap(logsWithTemplates, (v) => v[0]);
    const templates = logsWithTemplates.map((v) => v[1]).filter((v) => !!v) as ApiCallTemplate[];
    const templatesById = keyBy(templates, 'id');

    return [[groupLog, ...individualLogs], templatesById];
  }

  const templatesById = templateIds.reduce((acc, templateId, index) => {
    // Templates are always returned in the same order that they
    // are called with
    const template: ApiCallTemplate = {
      encodedParameters: rawTemplates.parameters[index],
      endpointId: rawTemplates.endpointIds[index],
      id: templateId,
      providerId: rawTemplates.providerIds[index],
    };
    return { ...acc, [templateId]: template };
  }, {});

  return [[], templatesById];
}

export async function fetch(
  apiCalls: ClientRequest<ApiCall>[],
  fetchOptions: FetchOptions
): Promise<LogsData<ApiCallTemplatesById>> {
  const templateIds = apiCalls.filter((a) => a.templateId).map((a) => a.templateId);
  if (isEmpty(templateIds)) {
    return [[], {}];
  }

  // Requests are made for up to 10 templates at a time
  const groupedTemplateIds = chunk(uniq(templateIds), CONVENIENCE_BATCH_SIZE);

  // Create an instance of the contract that we can re-use
  const airnode = new ethers.Contract(fetchOptions.airnodeAddress, Airnode.ABI, fetchOptions.provider);

  // Fetch all groups of templates in parallel
  const promises = groupedTemplateIds.map((ids: string[]) => fetchTemplateGroup(airnode, ids));

  const templateResponses = await Promise.all(promises);
  const templateResponseLogs = flatMap(templateResponses, (t) => t[0]);

  // Merge all templates into a single object, keyed by their ID for faster/easier lookup
  const templatesById = templateResponses.reduce((acc, result) => {
    return { ...acc, ...result[1] };
  }, {});

  return [templateResponseLogs, templatesById];
}
