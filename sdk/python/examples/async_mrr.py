import asyncio

from iisupp_aria import ARIA


async def main() -> None:
    client = ARIA()
    print(await client.amrr())


asyncio.run(main())
