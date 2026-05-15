const fs = require("fs");
const path = require("path");

const USERS_FOLDER = path.join(__dirname, "../users");

const getNodes = (req, res) => {
  try {
    const users = fs.readdirSync(USERS_FOLDER);

    const result = users.map((user) => {
      const userPath = path.join(
        USERS_FOLDER,
        user
      );

      const files = fs.readdirSync(userPath);

      const chunks = files.map((file) => {
        const match = file.match(/chunk_(\d+)/);

        return match ? Number(match[1]) : null;
      });

      return {
        name: user,
        chunks: chunks.filter(
          (chunk) => chunk !== null
        ),
        online: true,
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getNodes };