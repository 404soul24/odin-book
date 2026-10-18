require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');

const { currentUser } = require('./src/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);
app.use(currentUser);

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/posts'));
app.use('/', require('./routes/users'));

app.use((req, res) => res.status(404).render('error', { code: 404, message: 'Page not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { code: 500, message: 'Something went wrong' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Odin Book listening on http://localhost:${port}`));