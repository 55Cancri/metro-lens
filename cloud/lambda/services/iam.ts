import * as Iam from '../types/iam'

/* define environment variables */
const JWT_SECRET = process.env.JWT_SECRET || ''

export const iamServiceProvider = ({ iam }: Iam.IamServiceProviderProps) => {
  const generateToken = (payload: Record<string, string>) =>
    iam.sign(payload, JWT_SECRET, { expiresIn: '15m' })

  const validateToken = () => {}

  return { generateToken, validateToken }
}
