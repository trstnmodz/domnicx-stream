const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3001;

const STORAGE = path.join(
  process.env.HOME,
  "storage/shared/DomnicxStream"
);

const VIDEOS = path.join(STORAGE, "videos");
const THUMBNAILS = path.join(STORAGE, "thumbnails");

fs.mkdirSync(VIDEOS, { recursive: true });
fs.mkdirSync(THUMBNAILS, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.diskStorage({
    destination: VIDEOS,
    filename: (req, file, cb) => {
      const safe = path.basename(file.originalname)
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, Date.now() + "-" + safe);
    }
  })
});

// Server status
app.get("/api/status", (req, res) => {
  res.json({ name: "Domnicx Stream", status: "online" });
});

// List videos
app.get("/api/videos", (req, res) => {
  const files = fs.readdirSync(VIDEOS)
    .filter(name => /\.(mp4|webm|ogg)$/i.test(name));

  res.json(files.map((filename, index) => ({
    id: index + 1,
    title: filename,
    filename,
    stream: "/api/stream/" + encodeURIComponent(filename)
  })));
});

// Upload video
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No video uploaded" });
  }

  res.json({
    message: "Video uploaded",
    filename: req.file.filename
  });
});

// Stream video with seeking support
app.get("/api/stream/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);

  if (!/\.(mp4|webm|ogg)$/i.test(filename)) {
    return res.sendStatus(400);
  }

  const file = path.join(VIDEOS, filename);

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return res.sendStatus(404);
  }

  const size = fs.statSync(file).size;
  const range = req.headers.range;

  const contentTypes = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg"
  };

  const contentType =
    contentTypes[path.extname(filename).toLowerCase()];

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number(parts[0]);
    const end = parts[1] ? Number(parts[1]) : size - 1;

    if (!Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 || end < start || end >= size) {
      return res.status(416).end();
    }

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": contentType
    });

    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": size,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes"
    });

    fs.createReadStream(file).pipe(res);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Domnicx Stream running on port ${PORT}`);
});
