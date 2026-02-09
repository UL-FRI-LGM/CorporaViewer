# ParlaVis

The ParlaVis web application is designed for browsing and searching through multilingual proceedings of historical parliamentary sessions that have been scanned and OCR-processed and are available in digital form. The application allows users to view the facsimile of an individual proceedings (in PDF format) alongside its transcription, and also includes a powerful search engine for these documents. Searches can be performed by keywords or phrases, as well as by the name of the speaker or the place discussed. Since all these proceedings are multilingual, the search can be limited to a specific language or search in translations of the text. Search results can also be filtered by document date and corpus, and sorted by the date of the document or by relevance. The search results are displayed as a preview of the document facsimile, along with highlighted sections that match the query.

The web application is available at: [ParlaVis](https://parlavis.si/)

NOTE: The old name _CorporaViewer_ is used in repository name and these instructions, but the application was renamed to _ParlaVis_. Both names do refer to the same application.


## Content

The project includes the following parts:
- Backend
- Frontend
- ParsingScripts
- CorporaViewer_v1

## Backend

Backend service for ParlaVis application (TypeScript/Node). Uses Elasticsearch for search indexes. Runs in Docker. See Readme in Backend directory for details.  
Backend is started by running `npm start`.

## Frontend

Frontend for ParlaVis application (Vue).  
Frontend is started (when backend is already running) by running `npm run serve`.  
The application is available at local address: http://localhost:8080/.

## ParsingScripts

Various scripts for preparing the data and uploading to ElasticSearch. 
See Readme in ParsingScripts for instructions on how to set up the application.

## CorporaViewer_v1

The first version of ParlaVis (then called CorporaViewer) from 2023 by Martin Stojanoski. Available for archiving purposes only.
