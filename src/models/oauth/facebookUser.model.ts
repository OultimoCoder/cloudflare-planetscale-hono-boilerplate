import { authProviders } from '../../config/authProviders'
import { FacebookUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauthBase.model'

export class FacebookUser extends OAuthUserModel {
  constructor(user: FacebookUserType) {
    super({
      providerType: authProviders.FACEBOOK,
      _name: `${user.first_name} ${user.last_name}`,
      _id: user.id,
      _email: user.email
    })
  }
}
