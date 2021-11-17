import React from 'react'
import { ApolloClient, InMemoryCache, gql } from '@apollo/client'

export default function Debug() {
  const API_URL = "https://api.thegraph.com/subgraphs/name/deividask/chainlink";

  const tokensQuery = `
{
  feeds(where: {version:4, name:"BNB/USD"}) {
    id
    version
    name
    oracleCount
    rounds(first: 5, orderBy: unixTimestamp, orderDirection: desc) {
      id
      value
      unixTimestamp
    }
  }
}
  `

  const client = new ApolloClient({
    uri: API_URL,
    cache: new InMemoryCache()
  });

  client.query({
    query: gql(tokensQuery)
  })
  .then(data => console.info("Subgraph data: ", data))
  .catch(err => { console.info("Error fetching data: ", err) });

  return(
    <div className="Debug">
    </div>
  )
}
