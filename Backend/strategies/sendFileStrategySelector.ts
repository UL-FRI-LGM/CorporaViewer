import {SendPDFStrategy, SendPngImageStrategy} from './SendFileStrategy';

const getStrategy = (fileExtension: string) => {
    switch (fileExtension.toLowerCase()) {
        case '.png':
            return new SendPngImageStrategy();
            break;
        case '.pdf':
            return new SendPDFStrategy();
            break;
        default:
            throw new Error('Unsupported file extension');
    }
}

export default {
    getStrategy
}
