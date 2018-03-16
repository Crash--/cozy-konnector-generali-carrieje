const { errors, log, requestFactory } = require('cozy-konnector-libs')
const { encode, deduce } = require('./digipad')

const jar = module.exports.jar = require('request-promise').jar()
const request = requestFactory({
  cheerio: true,
  json: false,
  jar
})

const baseUrl = 'https://www.generali.fr'

module.exports.login = function (fields) {
  const firstStepUrl = `${baseUrl}/espace-client/public/connexion`
  const secondStepUrl = `${baseUrl}/espace-client/private/individuel/redirect-ece-eca`

  return request(firstStepUrl)
  .then($ => {
    const [action, inputs] = formContent($, 'generali-connexion-form')
    const table = getConversionTable($)
    inputs.identifiant = fields.login
    inputs.keyboard = encode(fields.password, table)

    return [action, inputs]
  })
  .then(([action, inputs]) => post(`${baseUrl}${action}`, inputs))
  .then($ => evaluateSuccess($, '1'))
  .then(() => request(secondStepUrl))
  .then($ => formContent($, 'generali-connexion-ece-eca-form'))
  .then(([action, inputs]) => post(action, inputs))
  .then($ => evaluateSuccess($, '2'))
}

function evaluateSuccess ($, step) {
  // log('info', $('#block-generali-topbar-topbar-accueil-client').text())
  const error = $('#generali_error_messages')
  if (error.length >= 1 && error.html().trim() !== '') {
    log('error', `Login process [${step}/2] failed`)
    log('debug', error.text())
    throw new Error(errors.LOGIN_FAILED)
  } else {
    log('ok', `Login process [${step}/2]`)
  }
}

function getConversionTable ($) {
  const table = new Map()
  $('#generali-connexion-form').find('button.c-field__keyboard__btn').each(function () {
    const image = $(this).attr('style').split(' ').pop()
    // NOTE: See #1135 on github@cheeriojs/cheerio
    // .css() is bugged, and prevent a correct parsing in our situation
    const digit = deduce.get(image)
    const value = $(this).attr('data-value')
    table.set(digit, value)
  })
  return table
}

function formContent ($, formId) {
  const action = $(`#${formId}`).attr('action')
  const inputs = {}
  $(`#${formId} input`).each(function () {
    inputs[$(this).attr('name')] = $(this).attr('value')
  })
  return [action, inputs]
}

function post (uri, inputs) {
  return request({
    uri: uri,
    method: 'POST',
    form: {
      ...inputs
    }
  })
}
