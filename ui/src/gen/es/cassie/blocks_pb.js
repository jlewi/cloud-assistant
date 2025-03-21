// @generated by protoc-gen-es v2.2.3 with parameter "target=js+dts,import_extension=none,json_types=true"
// @generated from file cassie/blocks.proto (syntax proto3)
/* eslint-disable */

import { enumDesc, fileDesc, messageDesc, serviceDesc, tsEnum } from "@bufbuild/protobuf/codegenv1";
import { file_cassie_filesearch } from "./filesearch_pb";

/**
 * Describes the file cassie/blocks.proto.
 */
export const file_cassie_blocks = /*@__PURE__*/
  fileDesc("ChNjYXNzaWUvYmxvY2tzLnByb3RvIpMCCgVCbG9jaxIYCgRraW5kGAEgASgOMgouQmxvY2tLaW5kEhAKCGxhbmd1YWdlGAIgASgJEhAKCGNvbnRlbnRzGAMgASgJEgoKAmlkGAcgASgJEiYKCG1ldGFkYXRhGAggAygLMhQuQmxvY2suTWV0YWRhdGFFbnRyeRIYCgRyb2xlGAkgASgOMgouQmxvY2tSb2xlEi4KE2ZpbGVfc2VhcmNoX3Jlc3VsdHMYCiADKAsyES5GaWxlU2VhcmNoUmVzdWx0Eh0KB291dHB1dHMYCyADKAsyDC5CbG9ja091dHB1dBovCg1NZXRhZGF0YUVudHJ5EgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCToCOAEiLgoLQmxvY2tPdXRwdXQSHwoFaXRlbXMYASADKAsyEC5CbG9ja091dHB1dEl0ZW0iMgoPQmxvY2tPdXRwdXRJdGVtEgwKBG1pbWUYASABKAkSEQoJdGV4dF9kYXRhGAIgASgJIikKD0dlbmVyYXRlUmVxdWVzdBIWCgZibG9ja3MYASADKAsyBi5CbG9jayIqChBHZW5lcmF0ZVJlc3BvbnNlEhYKBmJsb2NrcxgBIAMoCzIGLkJsb2NrKlIKCUJsb2NrS2luZBIWChJVTktOT1dOX0JMT0NLX0tJTkQQABIKCgZNQVJLVVAQARIICgRDT0RFEAISFwoTRklMRV9TRUFSQ0hfUkVTVUxUUxADKlIKCUJsb2NrUm9sZRIWChJCTE9DS19ST0xFX1VOS05PV04QABITCg9CTE9DS19ST0xFX1VTRVIQARIYChRCTE9DS19ST0xFX0FTU0lTVEFOVBACMkQKDUJsb2Nrc1NlcnZpY2USMwoIR2VuZXJhdGUSEC5HZW5lcmF0ZVJlcXVlc3QaES5HZW5lcmF0ZVJlc3BvbnNlIgAwAUJPQgtCbG9ja3NQcm90b1ABWj5naXRodWIuY29tL29wZW5haS9vcGVuYWkvYXBpL2Nsb3VkLWFzc2lzdGFudC9wcm90b3MvZ2VuL2Nhc3NpZWIGcHJvdG8z", [file_cassie_filesearch]);

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
 * BlocksService generates blocks.
 *
 * @generated from service BlocksService
 */
export const BlocksService = /*@__PURE__*/
  serviceDesc(file_cassie_blocks, 0);

