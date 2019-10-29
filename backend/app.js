const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const swaggerUi = require('swagger-ui-express');
const config = require('./config/index');

const usersRouter = require('./users/api');

require('dotenv').config();

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('combined', { stream: config.winston.stream }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Start: security settings
app.use(helmet());

app.set('trust proxy', 1);
app.use(
  session({
    secret: 's3Cur3',
    name: 'sessionId',
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true, // minimize risk of XSS attacks
      secure: true, // only send cookie over https
      maxAge: 60000 * 60 * 24, // set cookie expiry length in ms
    },
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// apply to all requests
app.use(limiter);

// End: security settings

app.use('/users', usersRouter);

// Start: swagger
if (process.env.NODE_ENV !== 'production') {
  app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(config.swaggerSpec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(config.swaggerSpec));
}
// End: swagger

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404);
  res.send('404');
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  config.winston.error(
    `${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
  );

  // render the error page
  res.status(err.status || 500);
  res.send('500');
});

module.exports = app;
