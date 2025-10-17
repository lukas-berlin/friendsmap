const joi = require("joi");

const validateRequestBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const msg = error.details.map((detail) => detail.message).join(", ");
    console.log(`${req.method} ${req.originalUrl}: ${msg}`);
    res.status(406).send(`E_PARAMETERS_INCORRECT\n${msg}`);
  } else {
    req.body = value;
    next();
  }
};

exports.storeLocation = validateRequestBody(
  joi
    .object()
    .keys({
      name: joi.string().required(),
      location: joi
        .object()
        .keys({
          latitude: joi.number().required(),
          longitude: joi.number().required(),
        })
        .required(),
    })
    .required()
);
