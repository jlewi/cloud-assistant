import { Box, Flex, ScrollArea, Text } from '@radix-ui/themes'

import openaiLogo from './assets/openai.svg'

function Layout({
  left,
  middle,
  right,
}: {
  left: React.ReactNode
  middle: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <Box className="w-screen h-screen max-w-[95%] mx-auto overflow-hidden flex flex-col">
      {/* Navbar, links are just a facade for now */}
      <Box
        className="w-full p-3 mb-1 border-b"
        style={{ backgroundColor: 'var(--color-panel-solid)' }}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <img src={openaiLogo} alt="OpenAI Logo" className="h-6 w-6" />
            <Text size="5" weight="bold">
              Cloud Assistant
            </Text>
          </Flex>
          <Flex gap="4">
            <Flex className="cursor-pointer" gap="1" align="center">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.5 0.875C7.77614 0.875 8 1.09886 8 1.375V7.5H14.125C14.4011 7.5 14.625 7.72386 14.625 8C14.625 8.27614 14.4011 8.5 14.125 8.5H8V14.625C8 14.9011 7.77614 15.125 7.5 15.125C7.22386 15.125 7 14.9011 7 14.625V8.5H0.875C0.598858 8.5 0.375 8.27614 0.375 8C0.375 7.72386 0.598858 7.5 0.875 7.5H7V1.375C7 1.09886 7.22386 0.875 7.5 0.875Z"
                  fill="currentColor"
                />
              </svg>
              <Text>New Session</Text>
            </Flex>
            <Flex className="cursor-pointer" gap="1" align="center">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.07095 0.650238C6.67391 0.650238 6.32977 0.925096 6.24198 1.31231L6.0039 2.36247C5.6249 2.47269 5.26335 2.62363 4.92436 2.81013L4.01335 2.23585C3.67748 2.02413 3.23978 2.07312 2.95903 2.35386L2.35294 2.95996C2.0722 3.2407 2.0232 3.6784 2.23493 4.01427L2.80942 4.92561C2.62307 5.2645 2.47227 5.62594 2.36216 6.00481L1.31209 6.24287C0.924883 6.33065 0.650024 6.6748 0.650024 7.07183V7.92897C0.650024 8.32601 0.924883 8.67015 1.31209 8.75794L2.36228 8.99603C2.47246 9.375 2.62335 9.73652 2.80979 10.0755L2.2354 10.9867C2.02367 11.3225 2.07267 11.7602 2.35341 12.041L2.95951 12.6471C3.24025 12.9278 3.67795 12.9768 4.01382 12.7651L4.92506 12.1907C5.26384 12.377 5.62516 12.5278 6.0039 12.6379L6.24198 13.6881C6.32977 14.0753 6.67391 14.3502 7.07095 14.3502H7.92809C8.32512 14.3502 8.66927 14.0753 8.75705 13.6881L8.99505 12.6383C9.37411 12.5282 9.73573 12.3773 10.0748 12.1909L10.986 12.7653C11.3218 12.977 11.7595 12.928 12.0403 12.6473L12.6464 12.0412C12.9271 11.7604 12.9761 11.3227 12.7644 10.9869L12.1902 10.076C12.3768 9.73688 12.5278 9.37515 12.638 8.99596L13.6879 8.75794C14.0751 8.67015 14.35 8.32601 14.35 7.92897V7.07183C14.35 6.6748 14.0751 6.33065 13.6879 6.24287L12.6381 6.00488C12.528 5.62578 12.3771 5.26414 12.1906 4.92507L12.7648 4.01407C12.9766 3.6782 12.9276 3.2405 12.6468 2.95975L12.0407 2.35366C11.76 2.07292 11.3223 2.02392 10.9864 2.23565L10.0755 2.80989C9.73622 2.62328 9.37437 2.47229 8.99505 2.36209L8.75705 1.31231C8.66927 0.925096 8.32512 0.650238 7.92809 0.650238H7.07095ZM4.92053 3.81251C5.44724 3.44339 6.05665 3.18424 6.71543 3.06839L7.07095 1.50024H7.92809L8.28355 3.06816C8.94267 3.18387 9.5524 3.44302 10.0794 3.81224L11.4397 2.9547L12.0458 3.56079L11.1887 4.92117C11.558 5.44798 11.8173 6.0575 11.9332 6.71638L13.5 7.07183V7.92897L11.9334 8.28444C11.8176 8.94342 11.5585 9.55301 11.1892 10.0798L12.0459 11.4394L11.4398 12.0455L10.0797 11.1889C9.55252 11.5583 8.94242 11.8176 8.28355 11.9334L7.92809 13.5002H7.07095L6.71543 11.9332C6.0569 11.8174 5.44772 11.5582 4.92116 11.189L3.56055 12.0455L2.95445 11.4394L3.81107 10.0794C3.4418 9.55266 3.18265 8.94307 3.06681 8.28395L1.50002 7.92897V7.07183L3.06697 6.71632C3.18305 6.05684 3.44247 5.44693 3.81203 4.91979L2.95424 3.56079L3.56034 2.9547L4.92053 3.81251ZM9.02496 7.50008C9.02496 8.34226 8.34223 9.02499 7.50005 9.02499C6.65786 9.02499 5.97513 8.34226 5.97513 7.50008C5.97513 6.65789 6.65786 5.97516 7.50005 5.97516C8.34223 5.97516 9.02496 6.65789 9.02496 7.50008ZM9.97496 7.50008C9.97496 8.86866 8.86863 9.97499 7.50005 9.97499C6.13146 9.97499 5.02513 8.86866 5.02513 7.50008C5.02513 6.13149 6.13146 5.02516 7.50005 5.02516C8.86863 5.02516 9.97496 6.13149 9.97496 7.50008Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                ></path>
              </svg>
              <Text>Settings</Text>
            </Flex>
            <Flex className="cursor-pointer" gap="1" align="center">
              <svg
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM8.24992 4.49999C8.24992 4.9142 7.91413 5.24999 7.49992 5.24999C7.08571 5.24999 6.74992 4.9142 6.74992 4.49999C6.74992 4.08577 7.08571 3.74999 7.49992 3.74999C7.91413 3.74999 8.24992 4.08577 8.24992 4.49999ZM6.00003 5.99999H6.50003H7.50003C7.77618 5.99999 8.00003 6.22384 8.00003 6.49999V9.99999H8.50003H9.00003V11H8.50003H7.50003H6.50003H6.00003V9.99999H6.50003H7.00003V6.99999H6.50003H6.00003V5.99999Z"
                  fill="currentColor"
                  fillRule="evenodd"
                  clipRule="evenodd"
                ></path>
              </svg>
              <Text>Help</Text>
            </Flex>
          </Flex>
        </Flex>
      </Box>

      {/* Main content */}
      <Flex className="w-full flex-1 gap-4 justify-between overflow-hidden p-2">
        {/* Left */}
        <Box className="flex-1 h-full flex flex-col">
          <Text size="5" weight="bold" className="mb-2">
            How can I help you?
          </Text>
          <ScrollArea className="h-[calc(100%-40px)] flex-1">{left}</ScrollArea>
        </Box>

        {/* Middle */}
        <Box className="flex-1 h-full flex flex-col">
          <Text size="5" weight="bold" className="mb-2">
            Actions
          </Text>
          <ScrollArea className="h-[calc(100%-40px)] flex-1">
            {middle}
          </ScrollArea>
        </Box>

        {/* Right */}
        <Box className="flex-1 h-full flex flex-col">
          <Text size="5" weight="bold" className="mb-2">
            Files
          </Text>
          <ScrollArea className="h-[calc(100%-40px)] flex-1">
            {right}
          </ScrollArea>
        </Box>
      </Flex>
    </Box>
  )
}

export default Layout
