import DataURIParser from 'datauri/parser';
import { DataURI } from 'datauri/types';

const parser = new DataURIParser();

const bufferToDataURI = (fileFormat: string, buffer: DataURI.Input) => parser.format(fileFormat, buffer);

export { bufferToDataURI };
