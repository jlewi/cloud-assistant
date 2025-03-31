import { useEffect, useMemo, useRef } from 'react'

import { create } from '@bufbuild/protobuf'

import { Block, useBlock } from '../../contexts/BlockContext'
import { BlockSchema } from '../../gen/es/cassie/blocks_pb'

const FileViewer = () => {
  // The code below is using "destructuring" assignment to assign certain values from the
  // context object return by useBlock to local variables.
  const { useColumns } = useBlock()
  const { files } = useColumns()

  // automatically scroll to bottom of files
  const filesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollToBottom = () => {
    filesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const oneBlock = useMemo(() => {
    let block: Block = create(BlockSchema, {})

    // N.B. Right now we don't support more than one search block
    if (files.length > 0) {
      block = files[files.length - 1]
    }

    return block
  }, [files])

  // TODO(jlewi): Why do we pass in chatBlocks as a dependency?
  // sebastian: because otherwise it won't rerender when the block changes
  useEffect(() => {
    scrollToBottom()
  }, [oneBlock])

  return (
    <div>
      <div
        className={`${oneBlock.fileSearchResults.length !== 0 ? 'grow' : ''}`}
      >
        {oneBlock.fileSearchResults.length === 0 ? (
          <div>No search results yet</div>
        ) : (
          oneBlock.fileSearchResults.map((b) => {
            return (
              <div key={b.FileID}>
                <div>
                  <span>
                    <a href={b.Link} target="_blank">
                      {b.FileName}
                    </a>
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={filesEndRef} className="h-1" />
      </div>
    </div>
  )
}

export default FileViewer
