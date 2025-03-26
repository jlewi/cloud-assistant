// @generated by protoc-gen-es v2.2.3 with parameter "target=js+dts,import_extension=none,json_types=true"
// @generated from file cassie/blocks.proto (syntax proto3)
/* eslint-disable */

import type { GenEnum, GenFile, GenMessage, GenService } from "@bufbuild/protobuf/codegenv1";
import type { Message } from "@bufbuild/protobuf";
import type { FileSearchResult, FileSearchResultJson } from "./filesearch_pb";

/**
 * Describes the file cassie/blocks.proto.
 */
export declare const file_cassie_blocks: GenFile;

/**
 * Block represents the data in an element in the UI.
 *
 * @generated from message Block
 */
export declare type Block = Message<"Block"> & {
  /**
   * BlockKind is an enum indicating what type of block it is e.g text or output
   *
   * @generated from field: BlockKind kind = 1;
   */
  kind: BlockKind;

  /**
   * language is a string identifying the language.
   *
   * @generated from field: string language = 2;
   */
  language: string;

  /**
   * contents is the actual contents of the block.
   * Not the outputs of the block.
   *
   * @generated from field: string contents = 3;
   */
  contents: string;

  /**
   * ID of the block.
   *
   * @generated from field: string id = 7;
   */
  id: string;

  /**
   * Additional metadata
   *
   * @generated from field: map<string, string> metadata = 8;
   */
  metadata: { [key: string]: string };

  /**
   * @generated from field: BlockRole role = 9;
   */
  role: BlockRole;

  /**
   * @generated from field: repeated FileSearchResult file_search_results = 10;
   */
  fileSearchResults: FileSearchResult[];

  /**
   * @generated from field: repeated BlockOutput outputs = 11;
   */
  outputs: BlockOutput[];
};

/**
 * Block represents the data in an element in the UI.
 *
 * @generated from message Block
 */
export declare type BlockJson = {
  /**
   * BlockKind is an enum indicating what type of block it is e.g text or output
   *
   * @generated from field: BlockKind kind = 1;
   */
  kind?: BlockKindJson;

  /**
   * language is a string identifying the language.
   *
   * @generated from field: string language = 2;
   */
  language?: string;

  /**
   * contents is the actual contents of the block.
   * Not the outputs of the block.
   *
   * @generated from field: string contents = 3;
   */
  contents?: string;

  /**
   * ID of the block.
   *
   * @generated from field: string id = 7;
   */
  id?: string;

  /**
   * Additional metadata
   *
   * @generated from field: map<string, string> metadata = 8;
   */
  metadata?: { [key: string]: string };

  /**
   * @generated from field: BlockRole role = 9;
   */
  role?: BlockRoleJson;

  /**
   * @generated from field: repeated FileSearchResult file_search_results = 10;
   */
  fileSearchResults?: FileSearchResultJson[];

  /**
   * @generated from field: repeated BlockOutput outputs = 11;
   */
  outputs?: BlockOutputJson[];
};

/**
 * Describes the message Block.
 * Use `create(BlockSchema)` to create a new message.
 */
export declare const BlockSchema: GenMessage<Block, BlockJson>;

/**
 * BlockOutput represents the output of a block.
 * It corresponds to a VSCode NotebookCellOutput
 * https://github.com/microsoft/vscode/blob/98332892fd2cb3c948ced33f542698e20c6279b9/src/vscode-dts/vscode.d.ts#L14835
 *
 * @generated from message BlockOutput
 */
export declare type BlockOutput = Message<"BlockOutput"> & {
  /**
   * items is the output items. Each item is the different representation of the same output data
   *
   * @generated from field: repeated BlockOutputItem items = 1;
   */
  items: BlockOutputItem[];
};

/**
 * BlockOutput represents the output of a block.
 * It corresponds to a VSCode NotebookCellOutput
 * https://github.com/microsoft/vscode/blob/98332892fd2cb3c948ced33f542698e20c6279b9/src/vscode-dts/vscode.d.ts#L14835
 *
 * @generated from message BlockOutput
 */
export declare type BlockOutputJson = {
  /**
   * items is the output items. Each item is the different representation of the same output data
   *
   * @generated from field: repeated BlockOutputItem items = 1;
   */
  items?: BlockOutputItemJson[];
};

/**
 * Describes the message BlockOutput.
 * Use `create(BlockOutputSchema)` to create a new message.
 */
export declare const BlockOutputSchema: GenMessage<BlockOutput, BlockOutputJson>;

/**
 * BlockOutputItem represents an item in a block output.
 * It corresponds to a VSCode NotebookCellOutputItem
 * https://github.com/microsoft/vscode/blob/98332892fd2cb3c948ced33f542698e20c6279b9/src/vscode-dts/vscode.d.ts#L14753
 *
 * @generated from message BlockOutputItem
 */
export declare type BlockOutputItem = Message<"BlockOutputItem"> & {
  /**
   * mime is the mime type of the output item.
   *
   * @generated from field: string mime = 1;
   */
  mime: string;

  /**
   * value of the output item.
   * We use string data type and not bytes because the JSON representation of bytes is a base64
   * string. vscode data uses a byte. We may need to add support for bytes to support non text data
   * data in the future.
   *
   * @generated from field: string text_data = 2;
   */
  textData: string;
};

/**
 * BlockOutputItem represents an item in a block output.
 * It corresponds to a VSCode NotebookCellOutputItem
 * https://github.com/microsoft/vscode/blob/98332892fd2cb3c948ced33f542698e20c6279b9/src/vscode-dts/vscode.d.ts#L14753
 *
 * @generated from message BlockOutputItem
 */
export declare type BlockOutputItemJson = {
  /**
   * mime is the mime type of the output item.
   *
   * @generated from field: string mime = 1;
   */
  mime?: string;

  /**
   * value of the output item.
   * We use string data type and not bytes because the JSON representation of bytes is a base64
   * string. vscode data uses a byte. We may need to add support for bytes to support non text data
   * data in the future.
   *
   * @generated from field: string text_data = 2;
   */
  textData?: string;
};

/**
 * Describes the message BlockOutputItem.
 * Use `create(BlockOutputItemSchema)` to create a new message.
 */
export declare const BlockOutputItemSchema: GenMessage<BlockOutputItem, BlockOutputItemJson>;

/**
 * @generated from message GenerateRequest
 */
export declare type GenerateRequest = Message<"GenerateRequest"> & {
  /**
   * @generated from field: repeated Block blocks = 1;
   */
  blocks: Block[];
};

/**
 * @generated from message GenerateRequest
 */
export declare type GenerateRequestJson = {
  /**
   * @generated from field: repeated Block blocks = 1;
   */
  blocks?: BlockJson[];
};

/**
 * Describes the message GenerateRequest.
 * Use `create(GenerateRequestSchema)` to create a new message.
 */
export declare const GenerateRequestSchema: GenMessage<GenerateRequest, GenerateRequestJson>;

/**
 * @generated from message GenerateResponse
 */
export declare type GenerateResponse = Message<"GenerateResponse"> & {
  /**
   * @generated from field: repeated Block blocks = 1;
   */
  blocks: Block[];
};

/**
 * @generated from message GenerateResponse
 */
export declare type GenerateResponseJson = {
  /**
   * @generated from field: repeated Block blocks = 1;
   */
  blocks?: BlockJson[];
};

/**
 * Describes the message GenerateResponse.
 * Use `create(GenerateResponseSchema)` to create a new message.
 */
export declare const GenerateResponseSchema: GenMessage<GenerateResponse, GenerateResponseJson>;

/**
 * @generated from enum BlockKind
 */
export enum BlockKind {
  /**
   * @generated from enum value: UNKNOWN_BLOCK_KIND = 0;
   */
  UNKNOWN_BLOCK_KIND = 0,

  /**
   * @generated from enum value: MARKUP = 1;
   */
  MARKUP = 1,

  /**
   * @generated from enum value: CODE = 2;
   */
  CODE = 2,

  /**
   * @generated from enum value: FILE_SEARCH_RESULTS = 3;
   */
  FILE_SEARCH_RESULTS = 3,
}

/**
 * @generated from enum BlockKind
 */
export declare type BlockKindJson = "UNKNOWN_BLOCK_KIND" | "MARKUP" | "CODE" | "FILE_SEARCH_RESULTS";

/**
 * Describes the enum BlockKind.
 */
export declare const BlockKindSchema: GenEnum<BlockKind, BlockKindJson>;

/**
 * @generated from enum BlockRole
 */
export enum BlockRole {
  /**
   * @generated from enum value: BLOCK_ROLE_UNKNOWN = 0;
   */
  UNKNOWN = 0,

  /**
   * @generated from enum value: BLOCK_ROLE_USER = 1;
   */
  USER = 1,

  /**
   * @generated from enum value: BLOCK_ROLE_ASSISTANT = 2;
   */
  ASSISTANT = 2,
}

/**
 * @generated from enum BlockRole
 */
export declare type BlockRoleJson = "BLOCK_ROLE_UNKNOWN" | "BLOCK_ROLE_USER" | "BLOCK_ROLE_ASSISTANT";

/**
 * Describes the enum BlockRole.
 */
export declare const BlockRoleSchema: GenEnum<BlockRole, BlockRoleJson>;

/**
 * BlocksService generates blocks.
 *
 * @generated from service BlocksService
 */
export declare const BlocksService: GenService<{
  /**
   * Generate generates blocks. Responses are streamed.
   *
   * @generated from rpc BlocksService.Generate
   */
  generate: {
    methodKind: "server_streaming";
    input: typeof GenerateRequestSchema;
    output: typeof GenerateResponseSchema;
  },
}>;

