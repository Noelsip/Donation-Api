const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const pool = require('./config/sql');
const authRouter = require('./routes/auth');
const oauthRouter = require('./routes/oauth');
const projectRouter = require('./routes/project');
const adminRoutes = require('./routes/admin');
const donationRouter = require('./routes/donation');

dotenv.config();

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(bodyParser.json());

app.get('/', (req, res) =>{
    return res.json({
        message: 'API is working',
        subject: 'Donations API'
    });
});

app.get('/health', (req, res) => {
    return res.json({
        status: 'OK',
        timestamp: new Date()
    });
})

app.use('/auth', authRouter);
app.use('/auth', oauthRouter);
app.use('/project', projectRouter);
app.use('/admin', adminRoutes);
app.use('/donation', donationRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT,() => {
    console.log(`Server is running on port http://localhost:${PORT}`);
})
