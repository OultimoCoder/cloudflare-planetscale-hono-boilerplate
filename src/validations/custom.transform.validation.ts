import bcrypt from 'bcryptjs'

export const hashPassword = async (value: string): Promise<string> => {
  const hashedPassword = await bcrypt.hash(value, 8)
  return hashedPassword
}
