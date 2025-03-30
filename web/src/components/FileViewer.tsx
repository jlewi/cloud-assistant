import React, { useEffect, useRef } from 'react'

import { create } from '@bufbuild/protobuf'

import { Block, BlockKind, useBlock } from '../contexts/BlockContext'
import { BlockSchema } from '../gen/es/cassie/blocks_pb'
// TODO(jlewi): I don't think we are ussing css module files any more but not sure
// how to change this to the latest version which uses tailwind
import styles from './file-viewer.module.css'

// FileSearchResult is used to hold the values in the result of the FileSearchToolcall.
// TODO(jlewi): Does the TS SDK define this type already?
export type FileSearchResult = {
  file_id: string
  file_name: string
  score: number
}

const FileViewer = () => {
  // The code below is using "destructuring" assignment to assign certain values from the
  // context object return by useBlock to local variables.
  const { blocks: blocks, blockPositions: blockPositions } = useBlock()

  let searchBlocksIDs = blockPositions.get(BlockKind.FILE_SEARCH_RESULTS)
  if (!searchBlocksIDs) {
    searchBlocksIDs = []
  }

  const searchBlocks: Block[] = []

  searchBlocksIDs.map((blockId) => {
    const block = blocks.get(blockId) // Lookup block in the map
    if (!block) {
      return
    }
    searchBlocks.push(block)
  })

  // TODO(jlewi): Does this work?
  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // TODO(jlewi): Why do we pass in chatBlocks as a dependency?
  useEffect(() => {
    scrollToBottom()
  }, [searchBlocks])

  let block: Block = create(BlockSchema, {})

  // N.B. Right now we don't support more than one search block
  if (searchBlocks.length > 0) {
    block = searchBlocks[0]
  }

  return (
    <div>
      <div
        className={`${styles.filesList} ${
          block.fileSearchResults.length !== 0 ? styles.grow : ''
        }`}
      >
        {block.fileSearchResults.length === 0 ? (
          <div className={styles.title}>No Search Results</div>
        ) : (
          block.fileSearchResults.map((result) => {
            return (
              <div key={result.Link} className={styles.fileEntry}>
                <div className={styles.fileName}>
                  <span className={styles.fileName}>
                    <a href={result.Link} target="_blank">
                      {result.FileName}
                    </a>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default FileViewer
