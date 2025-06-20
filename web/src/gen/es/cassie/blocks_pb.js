// @generated by protoc-gen-es v2.2.3 with parameter "target=js+dts,import_extension=none,json_types=true"
// @generated from file cassie/blocks.proto (syntax proto3)
/* eslint-disable */

import { enumDesc, fileDesc, messageDesc, serviceDesc, tsEnum } from "@bufbuild/protobuf/codegenv1";
import { file_cassie_filesearch } from "./filesearch_pb";

/**
 * Describes the file cassie/blocks.proto.
 */
export const file_cassie_blocks = /*@__PURE__*/
  fileDesc("ChNjYXNzaWUvYmxvY2tzLnByb3RvIqQCCgVCbG9jaxIYCgRraW5kGAEgASgOMgouQmxvY2tLaW5kEhAKCGxhbmd1YWdlGAIgASgJEhAKCGNvbnRlbnRzGAMgASgJEgoKAmlkGAcgASgJEiYKCG1ldGFkYXRhGAggAygLMhQuQmxvY2suTWV0YWRhdGFFbnRyeRIYCgRyb2xlGAkgASgOMgouQmxvY2tSb2xlEi4KE2ZpbGVfc2VhcmNoX3Jlc3VsdHMYCiADKAsyES5GaWxlU2VhcmNoUmVzdWx0Eh0KB291dHB1dHMYCyADKAsyDC5CbG9ja091dHB1dBIPCgdjYWxsX2lkGAwgASgJGi8KDU1ldGFkYXRhRW50cnkSCwoDa2V5GAEgASgJEg0KBXZhbHVlGAIgASgJOgI4ASJOCgtCbG9ja091dHB1dBIfCgVpdGVtcxgBIAMoCzIQLkJsb2NrT3V0cHV0SXRlbRIeCgRraW5kGAIgASgOMhAuQmxvY2tPdXRwdXRLaW5kIjIKD0Jsb2NrT3V0cHV0SXRlbRIMCgRtaW1lGAEgASgJEhEKCXRleHRfZGF0YRgCIAEoCSJkCg9HZW5lcmF0ZVJlcXVlc3QSFgoGYmxvY2tzGAEgAygLMgYuQmxvY2sSHAoUcHJldmlvdXNfcmVzcG9uc2VfaWQYAiABKAkSGwoTb3BlbmFpX2FjY2Vzc190b2tlbhgDIAEoCSI/ChBHZW5lcmF0ZVJlc3BvbnNlEhYKBmJsb2NrcxgBIAMoCzIGLkJsb2NrEhMKC3Jlc3BvbnNlX2lkGAIgASgJKlIKCUJsb2NrS2luZBIWChJVTktOT1dOX0JMT0NLX0tJTkQQABIKCgZNQVJLVVAQARIICgRDT0RFEAISFwoTRklMRV9TRUFSQ0hfUkVTVUxUUxADKlIKCUJsb2NrUm9sZRIWChJCTE9DS19ST0xFX1VOS05PV04QABITCg9CTE9DS19ST0xFX1VTRVIQARIYChRCTE9DS19ST0xFX0FTU0lTVEFOVBACKkgKD0Jsb2NrT3V0cHV0S2luZBIdChlVTktOT1dOX0JMT0NLX09VVFBVVF9LSU5EEAASCgoGU1RET1VUEAESCgoGU1RERVJSEAIyRAoNQmxvY2tzU2VydmljZRIzCghHZW5lcmF0ZRIQLkdlbmVyYXRlUmVxdWVzdBoRLkdlbmVyYXRlUmVzcG9uc2UiADABQkNCC0Jsb2Nrc1Byb3RvUAFaMmdpdGh1Yi5jb20vamxld2kvY2xvdWQtYXNzaXN0YW50L3Byb3Rvcy9nZW4vY2Fzc2llYgZwcm90bzM", [file_cassie_filesearch]);

/**
 * Describes the message Block.
 * Use `create(BlockSchema)` to create a new message.
 */
export const BlockSchema = /*@__PURE__*/
  messageDesc(file_cassie_blocks, 0);

/**
 * Describes the message BlockOutput.
 * Use `create(BlockOutputSchema)` to create a new message.
 */
export const BlockOutputSchema = /*@__PURE__*/
  messageDesc(file_cassie_blocks, 1);

/**
 * Describes the message BlockOutputItem.
 * Use `create(BlockOutputItemSchema)` to create a new message.
 */
export const BlockOutputItemSchema = /*@__PURE__*/
  messageDesc(file_cassie_blocks, 2);

/**
 * Describes the message GenerateRequest.
 * Use `create(GenerateRequestSchema)` to create a new message.
 */
export const GenerateRequestSchema = /*@__PURE__*/
  messageDesc(file_cassie_blocks, 3);

/**
 * Describes the message GenerateResponse.
 * Use `create(GenerateResponseSchema)` to create a new message.
 */
export const GenerateResponseSchema = /*@__PURE__*/
  messageDesc(file_cassie_blocks, 4);

/**
 * Describes the enum BlockKind.
 */
export const BlockKindSchema = /*@__PURE__*/
  enumDesc(file_cassie_blocks, 0);

/**
 * @generated from enum BlockKind
 */
export const BlockKind = /*@__PURE__*/
  tsEnum(BlockKindSchema);

/**
 * Describes the enum BlockRole.
 */
export const BlockRoleSchema = /*@__PURE__*/
  enumDesc(file_cassie_blocks, 1);

/**
 * @generated from enum BlockRole
 */
export const BlockRole = /*@__PURE__*/
  tsEnum(BlockRoleSchema);

/**
 * Describes the enum BlockOutputKind.
 */
export const BlockOutputKindSchema = /*@__PURE__*/
  enumDesc(file_cassie_blocks, 2);

/**
 * @generated from enum BlockOutputKind
 */
export const BlockOutputKind = /*@__PURE__*/
  tsEnum(BlockOutputKindSchema);

/**
 * BlocksService generates blocks.
 *
 * @generated from service BlocksService
 */
export const BlocksService = /*@__PURE__*/
  serviceDesc(file_cassie_blocks, 0);

