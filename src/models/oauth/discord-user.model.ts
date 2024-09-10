import { authProviders } from '../../config/authProviders'
import { DiscordUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauth-base.model'

export class DiscordUser extends OAuthUserModel {
  constructor(user: DiscordUserType) {
    super({
      providerType: authProviders.DISCORD,
      _name: user.username,
      _id: user.id,
      _email: user.email
    })
  }
}
