/**
 * @flow
 */

import fetch, {type Response} from 'node-fetch'

import logger from '../logger'
import type {BitbucketPullRequest, Config, PullRequest} from '../typedefs'

/**
 * Convert a Bitbucket PR to a PR representation
 * @param {BitbucketPullRequest} bbPr - the API response from a Bitbucket API looking for a PR
 * @returns {PullRequest} a pull request in standard format
 */
function convertPr (bbPr: BitbucketPullRequest): PullRequest {
  return {
    description: bbPr.description,
    headSha: bbPr.fromRef.latestCommit,
    number: bbPr.id,
    url: bbPr.links.self[0].href
  }
}

/**
 * VCS interface for Bitbucket Server
 *
 * @class
 * @implements {Vcs}
 */
export default class BitbucketServer {
  baseUrl: string
  config: Config

  /**
   * @param {Config} config - the configuration object
   */
  constructor (config: Config): void {
    this.config = config

    const password = this.config.computed.vcs.auth.password
    const username = this.config.computed.vcs.auth.username
    const domain = this.config.vcs.domain
    this.baseUrl = `https://${username}:${encodeURIComponent(password)}@${domain}/rest/api/1.0`
  }

  /**
   * Sometimes, based on the CI system, one might need to create a git remote to
   * be able to push, this method provides a hook to do just that.
   *
   * @returns {Promise} - a promise resolved with the name of the remote to be used for pushing
   */
  addRemoteForPush (): Promise<string> {
    // nothing to do
    return Promise.resolve('origin')
  }

  /**
   * Get the given PR
   * @param {String} prNumber - the PR number (i.e. 31)
   * @returns {PrPromise} a promise resolved with the PR object from the API
   */
  getPr (prNumber: string): Promise<PullRequest> {
    const owner = this.config.vcs.repository.owner
    const repo = this.config.vcs.repository.name
    const url = `${this.baseUrl}/projects/${owner}/repos/${repo}/pull-requests/${prNumber}`

    const safeUrl = url.replace(/https:\/\/[^:]+:[^@]+@/, 'https://')
    logger.log(`About to send GET to ${safeUrl}`)

    return fetch(url)
      .then((resp: Response) => {
        if (!resp.ok) {
          return resp.json().then((json: *) => {
            throw new Error(`${resp.status}: ${JSON.stringify(json)}`)
          })
        }
        return resp.json()
      })
      .then((bbPr: BitbucketPullRequest) => {
        return convertPr(bbPr)
      })
  }

  /**
   * Post a comment to the given PR
   * @param {String} prNumber - the PR number (i.e. 31)
   * @param {String} comment - the comment body
   * @returns {Promise} a promise resolved with result of posting the comment
   */
  postComment (prNumber: string, comment: string): Promise<*> {
    const owner = this.config.vcs.repository.owner
    const repo = this.config.vcs.repository.name
    const url = `${this.baseUrl}/projects/${owner}/repos/${repo}/pull-requests/${prNumber}/comments`
    const safeUrl = url.replace(/https:\/\/[^:]+:[^@]+@/, 'https://')
    logger.log(`About to send POST to ${safeUrl}`)

    return fetch(url, {
      body: JSON.stringify({text: comment}),
      headers: ['Content-Type', 'application/json'],
      method: 'POST'
    })
      .then((resp: Response) => {
        if (!resp.ok) {
          return resp.json().then((json: *) => {
            throw new Error(`${resp.status}: ${JSON.stringify(json)}`)
          })
        }
      })
  }
}
