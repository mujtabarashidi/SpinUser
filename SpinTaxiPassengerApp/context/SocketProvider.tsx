import React, { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import socket, { ensureSocketConnected, disconnectSocket, getSocketUrl } from '../services/socket/client';
import { SocketContext } from './SocketContext';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import NotificationService from '../services/NotificationService';

const SocketProvider = ({ children }: PropsWithChildren<{}>) => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Lyssna på app state ändringar
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log(`App State ändrades: ${appState} -> ${nextAppState}`);
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState]);

  useEffect(() => {
    console.log('[SocketProvider] Initialising connection to', getSocketUrl());
    ensureSocketConnected();

    const handleConnectError = (error: Error) => {
      console.warn('[SocketProvider] connection error', error.message);
    };
    const handleDisconnect = (reason: string) => {
      console.log('[SocketProvider] disconnected', reason);
    };
    const handleTripRequest = (tripRequest: any) => {
      console.log('[SocketProvider] Trip request received:', tripRequest);

      const formatSEK = (val: any) => {
        const n = Number(val);
        if (Number.isFinite(n)) return `${Math.round(n)} kr`;
        const s = String(val ?? '').trim();
        return s.endsWith('kr') ? s : (s ? `${s} kr` : '—');
      };

      // Normalisera server-payload -> AcceptTripView-format
      const pickupAddress =
        tripRequest?.pickupAddress ||
        tripRequest?.pickupLocationAddress ||
        tripRequest?.pickupLocationName ||
        'Okänd adress';
      const dropoffAddress =
        tripRequest?.dropoffAddress ||
        tripRequest?.dropoffLocationAddress ||
        tripRequest?.dropoffLocationName ||
        'Okänd adress';

      const distToPassengerM = Number(tripRequest?.distanceToPassenger ?? 0);
      const distToPassengerKm = distToPassengerM > 0 ? distToPassengerM / 1000 : 0;
      const etaToPassengerMin = Number(tripRequest?.estimatedArrivalTime ?? 0);

      const distToDropoffKm = Number(tripRequest?.distanceTodropoffLocation ?? 0);
      const timeToDropoffMin = Number(tripRequest?.travelTimeTodropoffLocation ?? 0);

      const normalized = {
        tripId: String(tripRequest?.tripId ?? ''),
        passengerId: tripRequest?.passengerUid || tripRequest?.passengerId,
        passengerName: tripRequest?.passengerName,
        phoneNumber: tripRequest?.passengerPhoneNumber,
        driverNote: tripRequest?.driverNote,
        tripCost: formatSEK(tripRequest?.tripCost),
        rideTypeEnum: { description: String(tripRequest?.selectedRideType || tripRequest?.rideType || '') },
        pickupLocationAddress: pickupAddress,
        dropoffLocationAddress: dropoffAddress,
        distanceToPassenger: distToPassengerKm ? `${distToPassengerKm.toFixed(2)} km` : '',
        travelTimeToPassenger: etaToPassengerMin ? `${etaToPassengerMin} min` : '',
        distanceTodropoffLocation: distToDropoffKm ? `${distToDropoffKm.toFixed(2)} km` : '',
        travelTimeTodropoffLocation: timeToDropoffMin ? `${Math.round(timeToDropoffMin)} min` : '',
        estimatedArrivalTime: etaToPassengerMin || undefined,
        status: tripRequest?.status,
      } as any;

      // Skicka systemhändelse som skärmar kan lyssna på och visa AcceptTripView
      try {
        DeviceEventEmitter.emit('incomingTripRequest', normalized);
      } catch (e) {
        console.warn('[SocketProvider] emit incomingTripRequest failed', e);
      }

      // Om appen är i bakgrunden, visa notifikation med korrekta fält
      if (appState !== 'active') {
        try {
          NotificationService.showNotification(
            'Ny reseförfrågan!',
            `${normalized.tripCost} - ${pickupAddress} till ${dropoffAddress}`,
            {
              tripId: normalized.tripId,
              tripCost: normalized.tripCost,
              pickupAddress,
              dropoffAddress,
            }
          );
        } catch (error) {
          console.error('[SocketProvider] Error sending notification:', error);
        }
      }
    };

    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('tripRequest', handleTripRequest);

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('tripRequest', handleTripRequest);
      disconnectSocket();
    };
  }, []);

  const contextValue = useMemo(() => ({
    on: socket.on.bind(socket),
    off: socket.off.bind(socket),
    emit: socket.emit.bind(socket),
    once: socket.once.bind(socket),
  }), []);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;
