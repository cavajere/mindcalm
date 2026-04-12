import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config'

const audioMimeTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav']
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp']

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.storage.audioPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.storage.imagesPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

export const uploadAudio = multer({
  storage: audioStorage,
  limits: { fileSize: config.storage.maxAudioSize },
  fileFilter: (_req, file, cb) => {
    if (audioMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato audio non supportato. Formati accettati: mp3, ogg, wav'))
    }
  },
})

export const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: config.storage.maxImageSize },
  fileFilter: (_req, file, cb) => {
    if (imageMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Formato immagine non supportato. Formati accettati: jpeg, png, webp'))
    }
  },
})

export const uploadAudioFiles = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dest = file.fieldname === 'audioFile'
        ? config.storage.audioPath
        : config.storage.imagesPath
      cb(null, dest)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${uuidv4()}${ext}`)
    },
  }),
  limits: { fileSize: config.storage.maxAudioSize },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'audioFile' && audioMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else if (file.fieldname === 'coverImage' && imageMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Formato file non supportato per ${file.fieldname}`))
    }
  },
})
