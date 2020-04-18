import * as Dynamo from '../types/dynamodb'

/* define environment variables */
const TABLE_NAME = process.env.TABLE_NAME || ''
const PRIMARY_KEY = process.env.PRIMARY_KEY || ''
const SORT_KEY = process.env.SORT_KEY || ''

/**
 * Service to interface with dynamodb. Dependencies must be injected.
 * @param deps
 */
export const dynamoServiceProvider = ({
  dynamodb,
  dateService,
}: Dynamo.DynamoServiceProviderProps) => {
  /**
   * Determine if a route should be checked by making sure it is not active
   * and the last check was over 12 hours ago.
   *
   * @param routeObject routeObject - the data of a specific route in dynamodb
   */
  const isActiveRoute = (routeObject: Dynamo.BusStatusItem) => {
    const hoursSinceLastCheck = dateService.getDifferenceInHours(
      new Date(),
      new Date(Number(routeObject.lastChecked))
    )

    return !routeObject.active || hoursSinceLastCheck > 12
  }

  const getApiCountToday = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :date1 AND :date2)',
      ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: {
        ':pk': 'api_counter',
        ':date1': dateService.getStartOfDay(),
        ':date2': dateService.getEndOfDay(),
      },
    }
    const { Items } = await dynamodb.query(params).promise()
    return <Dynamo.ApiCountTodayItem[]>Items
  }

  const getApiCountTotal = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND #sk = :skv',
      ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: {
        ':pk': 'api_counter',
        ':skv': 'total',
      },
    }
    const { Items } = await dynamodb.query(params).promise()
    return <Dynamo.ApiCountTotalItem[]>Items
  }

  const getStatusOfActiveBuses = async () => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
      ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
      ExpressionAttributeValues: { ':pk': 'bus', ':skv': 'status' },
    }
    const { Items } = await dynamodb.query(params).promise()
    return (<Dynamo.BusStatusItem[]>Items)?.filter(isActiveRoute)
  }

  const getVehiclesOfActiveBuses = async (
    retrievedStatusOfActiveBuses: Dynamo.BusStatusItem[] = []
  ) => {
    // get the metadata for buses with active status
    const statusOfActiveBuses =
      retrievedStatusOfActiveBuses?.length > 0
        ? retrievedStatusOfActiveBuses
        : await getStatusOfActiveBuses()

    // get the realtime data dynamodb items for the active buses
    const vehiclesOfActiveBuses = retrievedStatusOfActiveBuses.map(
      async (activeBus) => {
        const { Items } = await dynamodb
          .query({
            TableName: TABLE_NAME,
            KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :skv)',
            ExpressionAttributeNames: { '#pk': PRIMARY_KEY, '#sk': SORT_KEY },
            ExpressionAttributeValues: {
              ':pk': 'bus',
              ':skv': `v0_${activeBus.vehicleId}`,
            },
          })
          .promise()

        return Items as Dynamo.BusVehicleItem[]
      }
    )

    /* flatten the 2d array */
    return Promise.all(vehiclesOfActiveBuses).then(([vehicles]) => vehicles)
  }

  const batchWrite = async (requests: Dynamo.WriteRequest[]) => {
    /* define the params of the dynamoDB call */
    const params = { RequestItems: { [TABLE_NAME]: requests } }

    /* call the batch write to save the items to the table */
    return dynamodb.batchWrite(params).promise()
  }

  const generateItem = ({
    pk,
    sk,
    ...rest
  }: {
    pk: string
    sk: string
    [key: string]: unknown
  }) => ({
    [PRIMARY_KEY]: pk,
    [SORT_KEY]: sk,
    ...rest,
  })

  return {
    getApiCountToday,
    getApiCountTotal,
    getStatusOfActiveBuses,
    getVehiclesOfActiveBuses,
    generateItem,
    batchWrite,
  }
}
