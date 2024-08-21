/**
 * Expose the Entity class.
 */
module.exports = Entity

/**
 * Dependencies.
 */
const rfc2047 = require('rfc2047')
const debug = require('debug')('mimemessage:Entity')
const debugerror = require('debug')('mimemessage:ERROR:Entity')
const grammar = require('./grammar')
const parseHeaderValue = require('./parse').parseHeaderValue
const encoding = require('./encoding')

debugerror.log = console.warn.bind(console)

function Entity() {
  debug('new()')

  this.headers = {}
  this.internalBody = null
}

Entity.prototype.contentType = function(value) {
  // Get.
  if (!value && value !== null) {
    return this.headers['Content-Type']
  }
  // Set.
  if (value) {
    this.headers['Content-Type'] = parseHeaderValue(grammar.headerRules['Content-Type'], value)
    // Delete.
  } else {
    delete this.headers['Content-Type']
  }
}

Entity.prototype.contentDescription = function(value) {
  // Get.
  if (!value && value !== null) {
    return this.headers['Content-Description'] ? this.headers['Content-Description'].value : undefined
  }
  // Set.
  if (value) {
    this.headers['Content-Description'] = parseHeaderValue(grammar.headerRules['Content-Description'], value)
    // Delete.
  } else {
    delete this.headers['Content-Description']
  }
}

Entity.prototype.contentDisposition = function(value) {
  // Get.
  if (!value && value !== null) {
    return this.headers['Content-Disposition']
  }
  // Set.
  if (value) {
    this.headers['Content-Disposition'] = parseHeaderValue(grammar.headerRules['Content-Disposition'], value)
    // Delete.
  } else {
    delete this.headers['Content-Disposition']
  }
}

Entity.prototype.contentTransferEncoding = function(value) {
  const contentTransferEncoding = this.headers['Content-Transfer-Encoding']

  // Get.
  if (!value && value !== null) {
    return contentTransferEncoding ? contentTransferEncoding.value : undefined
  }
  // Set.
  if (value) {
    this.headers['Content-Transfer-Encoding'] = parseHeaderValue(grammar.headerRules['Content-Transfer-Encoding'], value)
    // Delete.
  } else {
    delete this.headers['Content-Transfer-Encoding']
  }
}

Entity.prototype.header = function(name, value) {
  const headername = grammar.headerize(name)

  // Get.
  if (!value && value !== null) {
    if (this.headers[headername]) {
      return this.headers[headername].value
    }
  } else if (value) {
    // Set.
    this.headers[headername] = {
      value
    }
    // Delete.
  } else {
    delete this.headers[headername]
  }
}

Object.defineProperty(Entity.prototype, 'body', {
  get() {
    return this.internalBody
  },
  set(body) {
    if (body) {
      setBody.call(this, body)
    } else {
      delete this.internalBody
    }
  }
})

Entity.prototype.isMultiPart = function() {
  const contentType = this.headers['Content-Type']

  return contentType && contentType.type === 'multipart'
}

Entity.prototype.toString = function(options = { noHeaders: false, unicode: false }) {
  const contentType = this.headers['Content-Type']
  const encode = options.unicode ? (x) => x : rfc2047.encode

  let raw = ''

  if (!options.noHeaders) {
    // MIME headers.
    const headers = Object.keys(this.headers).map((name) => {
      const val = this.headers[name].value
      const list = val.split(';').map((val) =>
        val
          .split('=')
          .map(encode)
          .join('=')
      )
      return name + ': ' + list.join(';') + '\r\n'
    })
    raw = headers.join('') + '\r\n'
  }

  // Body.
  if (Array.isArray(this.internalBody)) {
    const boundary = contentType.params.boundary
    // Check if this is an encrypted and signed message
    const encryptedAndSigned =
      contentType &&
      contentType.type === 'multipart' &&
      contentType.subtype === 'encrypted' &&
      this.headers['Content-Description'] &&
      this.headers['Content-Description'].value === 'OpenPGP encrypted message'

    if (encryptedAndSigned) raw += 'This is an OpenPGP/MIME encrypted message (RFC 4880 and 3156)\r\n'

    let i
    const len = this.internalBody.length

    for (i = 0; i < len; i++) {
      if (i > 0) {
        raw += '\r\n'
      }
      raw += '--' + boundary + '\r\n' + this.internalBody[i].toString(options)
    }
    raw += '\r\n--' + boundary + '--'
  } else if (typeof this.internalBody === 'string') {
    const { value } = this.headers['Content-Transfer-Encoding'] || {}
    const { params: { charset = '' } = {} } = this.contentType() || {}
    const transform = []

    if (charset.replace(/-/g, '').toLowerCase() === 'utf8') {
      transform.push(encoding.encodeUTF8)
    }

    if (value === 'base64') {
      transform.push(encoding.encodeBase64)
    } else if (value === 'quoted-printable') {
      transform.push(encoding.encodeQP)
    }

    raw += transform.reduce((body, cb) => cb(body), this.internalBody)
  } else if (typeof this.internalBody === 'object') {
    raw += JSON.stringify(this.internalBody)
  }

  return raw
}

const random16bitHex = () =>
  Math.floor(Math.random() * (2 << 15))
    .toString(16)
    .padStart(4, 0)
const random128bitHex = () =>
  new Array(8)
    .fill(null)
    .map(random16bitHex)
    .join('')

const generateBoundary = () => `---------------------${random128bitHex()}`

/**
 * Private API.
 */
function setBody(body) {
  const contentType = this.headers['Content-Type']

  this.internalBody = body

  // Multipart internalBody.
  if (Array.isArray(body)) {
    if (!contentType || contentType.type !== 'multipart') {
      this.contentType('multipart/mixed; boundary=' + generateBoundary())
    } else if (!contentType.params.boundary) {
      this.contentType(contentType.fulltype + '; boundary=' + generateBoundary())
    }
    // Single internalBody.
  } else if (!contentType || contentType.type === 'multipart') {
    this.contentType('text/plain; charset=utf-8')
  }
}
