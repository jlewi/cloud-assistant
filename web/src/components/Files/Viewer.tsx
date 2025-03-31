import { useEffect, useMemo, useRef } from 'react'

import { create } from '@bufbuild/protobuf'
import { Box, Link, Text } from '@radix-ui/themes'

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

  const hasSearchResults = oneBlock.fileSearchResults.length > 0

  if (!hasSearchResults) {
    return (
      <div>
        <div>
          <div>No search results yet</div>
          <div ref={filesEndRef} className="h-1" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="grow">
        {oneBlock.fileSearchResults.map((b) => (
          <div key={b.FileID} className="mb-2">
            <Box
              p="2"
              style={{ borderRadius: '6px', border: '1px solid var(--gray-5)' }}
            >
              <Text size="2" weight="medium">
                <Link
                  href={b.Link}
                  target="_blank"
                  className="text-blue-500 hover:underline"
                >
                  {b.FileName}
                </Link>
              </Text>
            </Box>
          </div>
        ))}
        <div ref={filesEndRef} className="h-1" />
      </div>
    </div>
  )
}

export default FileViewer
