import express, {Application} from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import router from './api/routers/router';

dotenv.config();

// Server parameters
const port: number = (process.env.PORT) ? parseInt(process.env.PORT) : 3000;
const ipAddress: string = process.env.IP_ADDRESS || "localhost";
const app: Application = express();

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded());
app.use("/api", router);

// Start server
app.listen(port, ipAddress, () => {
    console.log(`Server is running on http://${ipAddress}:${port}/`);
});
