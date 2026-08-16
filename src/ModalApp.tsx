import React, { useEffect, useState } from 'react'

import {
  CloneRepoWindow,
  ConfirmWindow,
  CreateRepoWindow,
  IdentityWindow,
  MergeBranchWindow,
  ScanResultsWindow,
} from './components/Modals'
import type { ModalType } from './types'

export function ModalApp({ type }: { type: ModalType }) {
  const [info, setInfo] = useState<unknown>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.getModalInfo(type).then((info) => {
      if (!cancelled) {
        setInfo(info)
        setReady(true)
      }
      return undefined
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [type])

  if (!ready) {
    return (
      <div className="loading-full">
        <span className="spinner" />
        {' '}
        Loading...
      </div>
    )
  }

  switch (type) {
    case 'confirm':
      return <ConfirmWindow info={info} />
    case 'create':
      return <CreateRepoWindow />
    case 'clone':
      return <CloneRepoWindow />
    case 'identity':
      return <IdentityWindow info={info} />
    case 'merge':
      return <MergeBranchWindow info={info} />
    case 'scan':
      return <ScanResultsWindow info={info} />
    default:
      return null
  }
}
