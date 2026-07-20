const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
// maxAge 0 + ETag: 매 방문 시 재검증(304)하므로 데이터 갱신이 즉시 반영된다
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

app.listen(PORT, () => {
  console.log(`ksic-search listening on :${PORT}`);
});
