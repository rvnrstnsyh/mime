const RFC2045_LIMIT = 76

const wrapline = (line, escape = '', limit = RFC2045_LIMIT) => {
  const lineCount = Math.ceil(line.length / limit)
  const result = Array.from({ length: lineCount }, (_, i) => line.substring(limit * i, limit * (i + 1)))
  return result.join(escape + '\r\n')
}

// the newlines in mime messages are \r\n. This function expects \n as incoming lines and produces \r\n newlines.
const wraplines = (lines, escape = '', limit = RFC2045_LIMIT) =>
  lines
    .split('\n')
    .map((line) => wrapline(line, escape, limit))
    .join('\r\n')

// Don't escape newlines, tabs, everything between space and ~ save the = sign.
const MATCH_ESCAPE_CHARS = /[^\t\n\r\x20-\x3C\x3E-\x7E]/g

const encodeQPSequence = (char) =>
  '=' +
  char
    .charCodeAt(0)
    .toString(16)
    .toUpperCase()
    .padStart(2, '0')

const encodeQPSequences = (input) => input.replace(MATCH_ESCAPE_CHARS, encodeQPSequence)

const normalLinebreaks = (input) => input.replace(/(\r\n|\n|\r)/g, '\n')

// restore wrapping in escape sequences ==\r\n0D, =0\r\nD -> =0D=\r\n
const restoreQPSequences = (input) => {
  return input.replace(/(?=.{0,2}=\r\n)(=(=\r\n)?[0-9A-F](=\r\n)?[0-9A-F])/g, (seq) => {
    return seq.replace(/=\r\n/, '') + '=\r\n'
  })
}

const wrapQPLines = (input) => restoreQPSequences(wraplines(input, '=', RFC2045_LIMIT - 2))
const encodeQPTrailingSpace = (input) => input.replace(/ $/gm, ' =\r\n\r\n')

const encodeUTF8 = (value) => Buffer.from(value).toString('binary')
const decodeUTF8 = (value) => {
  try {
    return Buffer.from(value, 'binary').toString('utf8')
  } catch (_error) {
    return value
  }
}

const encodeBase64 = (value) => wraplines(Buffer.from(value, 'binary').toString('base64'))
const decodeBase64 = (value) => Buffer.from(value.replace(/\s+/g, ''), 'base64').toString('binary')

/**
 * Quoted-Printable, or QP encoding, is an encoding using printable ASCII characters
 * (alphanumeric and the equals sign =) to transmit 8-bit data over a 7-bit data path)
 * Any 8-bit byte value may be encoded with 3 characters: an = followed by two hexadecimal digits (0–9 or A–F)
 * representing the byte's numeric value. For example, an ASCII form feed character (decimal value 12) can be
 * represented by "=0C", and an ASCII equal sign (decimal value 61) must be represented by =3D.
 * All characters except printable ASCII characters or end of line characters (but also =)
 * must be encoded in this fashion.
 *
 * All printable ASCII characters (decimal values between 33 and 126) may be represented by themselves, except =
 * (decimal 61).
 *
 * @param binarydata
 * @return 7-bit encoding of the input using QP encoding
 */
const encodeQP = (binarydata) => encodeQPTrailingSpace(wrapQPLines(normalLinebreaks(encodeQPSequences(binarydata))))

const removeSoftBreaks = (value) => value.replace(/=(\r\n|\n|\r)|/g, '')

const decodeQuotedPrintables = (value) => {
  return value.replace(/=([0-9A-F][0-9A-F])/gm, (_match, contents) => {
    return String.fromCharCode(parseInt(contents, 16))
  })
}

const decodeQP = (value) => decodeQuotedPrintables(removeSoftBreaks(value))

module.exports = {
  encodeBase64,
  decodeBase64,
  encodeQP,
  decodeQP,
  encodeUTF8,
  decodeUTF8
}
