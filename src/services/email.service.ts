import { SESClient, SendEmailCommand, Message } from '@aws-sdk/client-ses'
import { Config } from '../config/config'

let client: SESClient

interface EmailData {
  firstName: string
  lastName: string
  token: string
}

const getClient = (awsConfig: Config['aws']) => {
  client = client || new SESClient({
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey
    },
    region: awsConfig.region
  })
  return client
}

const sendEmail = async(to: string, sender: string, message: Message, awsConfig: Config['aws']) => {
  const sesClient = getClient(awsConfig)
  const command = new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Source: sender,
    Message: message
  })
  await sesClient.send(command)
}

const sendResetPasswordEmail = async (email: string, emailData: EmailData, config: Config) => {
  const message = {
    Subject: {
      Data: 'Reset your password',
      Charset: 'UTF-8'
    },
    Body: {
      Text: {
        Charset: 'UTF-8',
        Data: `
          Hello ${emailData.firstName} ${emailData.lastName}
          Please reset your password by clicking the following link:
          ${emailData.token}
        `
      }
    }
  }
  await sendEmail(
    email,
    config.email.sender,
    message,
    config.aws
  )
}

const sendVerificationEmail = async (email: string, emailData: EmailData, config: Config) => {
  const message = {
    Subject: {
      Data: 'Verify your email address',
      Charset: 'UTF-8'
    },
    Body: {
      Text: {
        Charset: 'UTF-8',
        Data: `
          Hello ${emailData.firstName} ${emailData.lastName}
          Please verify your email by clicking the following link:
          ${emailData.token}
        `
      }
    }
  }
  await sendEmail(
    email,
    config.email.sender,
    message,
    config.aws
  )
}

export {
  sendResetPasswordEmail,
  sendVerificationEmail
}
