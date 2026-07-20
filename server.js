const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT}`);
});
