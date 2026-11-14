const cors = require('cors');
const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', healthRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
