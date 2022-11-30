import bcrypt from 'bcryptjs'

const hashPassword = async (value: string) => {
  const hashedPassword = await bcrypt.hash(value, 8)
  return hashedPassword
}

export { hashPassword }
