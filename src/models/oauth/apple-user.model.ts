import { authProviders } from '../../config/authProviders'
import { AppleUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauth-base.model'

export class AppleUser extends OAuthUserModel {
  constructor(user: AppleUserType) {
    if (!user.email) {
      throw new Error('Apple account must have an email linked')
    }
    super({
      _id: user.sub,
      providerType: authProviders.APPLE,
      _name: user.name,
      _email: user.email
    })
  }
}
