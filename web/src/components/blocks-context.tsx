import React, {
  createContext,
  useContext,
  Dispatch,
  SetStateAction,
  useState,
  useEffect,
  ReactNode,
  FC,
} from "react";
import styles from "./file-viewer.module.css";
import * as blocks_pb from "../gen/es/cassie/blocks_pb";

// Define a context to keep track of blocks keyed by block id.

type BlocksContextType = {
  // Blocks is a map of all blocks from their ID to the actual proto
  blocks: Map<string, blocks_pb.Block>;
  // Block positions contains the IDs of the blocks in the order they should be presented.
  blockPositions: string[];
  setBlock: React.Dispatch<React.SetStateAction<Map<string, blocks_pb.Block>>>;
  setPositions: React.Dispatch<React.SetStateAction<string[]>>;

  // Define additional functions to update the state
  // This way they can be set in the provider and passed down to the components
  updateBlock: (block: blocks_pb.Block) => void;  
};

const BlocksContext = createContext<BlocksContextType>({
  blocks: new Map<string, blocks_pb.Block>(),
  blockPositions: [] as string[],
  setBlock: () => {},
  setPositions: () => {},
  updateBlock: () => {}, // Provide a no-op default
});

export const BlocksProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [blocks, setBlock] = useState<Map<string, blocks_pb.Block>>(new Map());
  const [blockPositions, setPositions] = useState<string[]>([]);

  const updateBlock = (block: blocks_pb.Block) => {
    if (!blocks.has(block.id)) {
        console.log(`adding block: ${block.id}`)
        
        // Is it ok to do this or is this violating the fact that state should only
        // be mutated by React state functions
        blocks.set(block.id, block)
  
        // Since this is the first time we see this block add it to the end of the list of blocks
        setPositions(prevBlocksPos => [...prevBlocksPos, block.id]);
      }      
        setBlock(prevBlocks => {       
        console.log(`Setblocks called with ${prevBlocks.size} elements`)
        console.log(`Setblocks called to add ${block.id}`)
        const newBlocks = new Map(prevBlocks); // Create a new Map instance
        newBlocks.set(block.id, block); // Remove the block
        return newBlocks; // Set the new state
        });
  };


  return (
    <BlocksContext.Provider
      value={{ blocks, blockPositions, setBlock, setPositions, updateBlock }}
    >
      {children}
    </BlocksContext.Provider>
  );
};

export const useBlocks = () => {
  return useContext(BlocksContext);
};

//  // Update the block 
//  const updateBlock = (block : blocks_pb.Block) => {
//     if (!blocks.has(block.id)) {
//       console.log(`adding block: ${block.id}`)
      
//       // Is it ok to do this or is this violating the fact that state should only
//       // be mutated by React state functions
//       blocks.set(block.id, block)

//       // Since this is the first time we see this block add it to the end of the list of blocks
//       setBlockPos(prevBlocksPos => [...prevBlocksPos, block.id]);
//     }      
//     setBlock(prevBlocks => {       
//       console.log(`Setblocks called with ${prevBlocks.size} elements`)
//       console.log(`Setblocks called to add ${block.id}`)
//       const newBlocks = new Map(prevBlocks); // Create a new Map instance
//       newBlocks.set(block.id, block); // Remove the block
//       return newBlocks; // Set the new state
//     });
//   };

//   const addBlock = (kind : blocks_pb.BlockKind) => {
//     const newBlock = create(blocks_pb.BlockSchema, {
//       kind: kind,
//       contents: "",
//       role: blocks_pb.BlockRole.USER,
//       id: uuidv4(),
//     })            
//     updateBlock(newBlock);
//   };
