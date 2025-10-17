module.exports = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    const status = (error.response && error.response.status) || 500;
    res.status(status).send(`${error}`);
  }
};
