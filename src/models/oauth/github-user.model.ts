import { authProviders } from '../../config/authProviders'
import { GithubUserType } from '../../types/oauth.types'
import { OAuthUserModel } from './oauth-base.model'

export class GithubUser extends OAuthUserModel {
  constructor(user: GithubUserType) {
    super({
      _id: user.id.toString(),
      providerType: authProviders.GITHUB,
      _name: user.name,
      _email: user.email
    })
  }
}
