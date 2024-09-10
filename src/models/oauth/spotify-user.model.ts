import { authProviders } from '../../config/authProviders'
import { SpotifyUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauth-base.model'

export class SpotifyUser extends OAuthUserModel {
  constructor(user: SpotifyUserType) {
    super({
      providerType: authProviders.SPOTIFY,
      _name: user.display_name,
      _id: user.id,
      _email: user.email
    })
  }
}
