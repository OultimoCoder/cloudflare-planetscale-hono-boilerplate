import { hash } from 'bcryptjs'

const hashPassword = async (value: string) => {
  const hashedPassword = await hash(value, 8)
  return hashedPassword
};

export {
  hashPassword
}
