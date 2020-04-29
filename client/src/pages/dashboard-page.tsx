/** @jsx jsx */
import React, { useEffect, useState } from 'react'
import { jsx } from '@emotion/core'
import axios from 'axios'
import { motion } from 'framer-motion'

const styles: Styles = {
  padding: '20px 50px',
}

const inputStyles: Styles = {
  display: 'grid',
  height: 25,
  width: '50%',
  padding: '4px 10px',
  border: 0,
  outline: 0,
  borderRadius: 4,
  backgroundColor: '#e6e6e6',
}

export const DashboardPage: React.FC = () => {
  const pageVariants = {
    initial: { scale: 0.9, opacity: 0 },
    enter: { scale: 1, opacity: 1 },
    exit: {
      scale: 0.5,
      opacity: 0,
      transition: { duration: 1.5 },
    },
  }

  const [loading, setLoading] = useState(true)
  const [userPosition, setUserPosition] = useState({})
  const [mapLink, setMapLink] = useState('')

  const storeUserPosition = async () => {
    const onSuccess = (position: Position) => {
      const { latitude } = position.coords
      const { longitude } = position.coords

      console.log({ position })

      setUserPosition({ lat: latitude, lon: longitude })
      setMapLink(
        `https://www.openstreetmap.org/#map=18/${latitude}/${longitude}`
      )
      setLoading(false)
    }

    const onError = () => {
      console.log('Unable to retrieve your location')
    }

    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by your browser')
    } else {
      console.log('Locating…')
      navigator.geolocation.getCurrentPosition(onSuccess, onError)
    }
  }

  useEffect(() => {
    storeUserPosition()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <motion.div
      css={styles}
      variants={pageVariants}
      initial="exit"
      animate="enter"
      exit="exit"
    >
      <header>
        <h1>Metro Lens</h1>
        <input css={inputStyles} />
      </header>
      <main>
        <div>
          <h2>Home to Dunn-Loring</h2>
          <a href={mapLink}>link</a>
        </div>
      </main>
    </motion.div>
  )
}
