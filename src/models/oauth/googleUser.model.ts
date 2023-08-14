import { authProviders } from '../../config/authProviders'
import { GoogleUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauthBase.model'

export class GoogleUser extends OAuthUserModel {
  constructor(user: GoogleUserType) {
    super({
      providerType: authProviders.GOOGLE,
      _name: user.name,
      _id: user.id,
      _email: user.email
    })
  }
}
