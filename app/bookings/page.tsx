'use client';

import React, { useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { useBookingStore } from '@/store/bookingStore';
import { SatelliteBooking } from '@/types';
import Link from 'next/link';

export default function BookingsPage() {
  const { bookings, removeBooking, updateBooking } = useBookingStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'completed'>('all');

  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const getStatusColor = (status: SatelliteBooking['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'completed':
        return 'default';
      case 'cancelled':
        return 'danger';
      default:
        return 'default';
    }
  };

  const handleCancelBooking = (id: string) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      updateBooking(id, { status: 'cancelled' });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalSpent = bookings
    .filter((b) => b.status === 'completed' || b.status === 'active')
    .reduce((sum, b) => sum + b.price, 0);

  const activeBookingsCount = bookings.filter((b) => b.status === 'active').length;
  const pendingBookingsCount = bookings.filter((b) => b.status === 'pending').length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">My Bookings</h1>
        <p className="text-gray-400">Manage your satellite reservations and view booking history</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-blue-500">{bookings.length}</div>
            <div className="text-sm text-gray-400">Total Bookings</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-green-500">{activeBookingsCount}</div>
            <div className="text-sm text-gray-400">Active</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-yellow-500">{pendingBookingsCount}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-purple-500">${totalSpent.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Spent</div>
          </CardBody>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6">
        <Button
          color={filter === 'all' ? 'primary' : 'default'}
          onPress={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          color={filter === 'active' ? 'success' : 'default'}
          onPress={() => setFilter('active')}
        >
          Active
        </Button>
        <Button
          color={filter === 'pending' ? 'warning' : 'default'}
          onPress={() => setFilter('pending')}
        >
          Pending
        </Button>
        <Button
          color={filter === 'completed' ? 'default' : 'default'}
          onPress={() => setFilter('completed')}
        >
          Completed
        </Button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg">No bookings found</p>
              <p className="text-sm mt-2">Start by booking a satellite from the main view</p>
            </div>
            <Link href="/">
              <Button color="primary">
                Book a Satellite
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <Card key={booking.id}>
              <CardBody>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{booking.satelliteName}</h3>
                      <Chip color={getStatusColor(booking.status)} size="sm">
                        {booking.status.toUpperCase()}
                      </Chip>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
                      <div>
                        <span className="font-semibold">Start:</span> {formatDate(booking.startTime)}
                      </div>
                      <div>
                        <span className="font-semibold">End:</span> {formatDate(booking.endTime)}
                      </div>
                      <div>
                        <span className="font-semibold">Duration:</span> {booking.duration} minutes
                      </div>
                      <div>
                        <span className="font-semibold">Data Rate:</span> {booking.dataRate}
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-semibold">Purpose:</span> {booking.purpose}
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-semibold">Ground Stations:</span> {booking.groundStations.length} stations
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-500">
                        ${booking.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        ${(booking.price / booking.duration).toFixed(2)}/min
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(booking.status === 'pending' || booking.status === 'active') && (
                        <Button
                          color="danger"
                          size="sm"
                          variant="light"
                          onPress={() => handleCancelBooking(booking.id)}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        color="danger"
                        size="sm"
                        variant="light"
                        onPress={() => removeBooking(booking.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Additional Features Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="font-semibold">Global Coverage</CardHeader>
          <CardBody>
            <p className="text-sm text-gray-400">
              Access satellites worldwide through our network of ground stations. No need to wait for a satellite pass!
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="font-semibold">Real-time Tracking</CardHeader>
          <CardBody>
            <p className="text-sm text-gray-400">
              Monitor your booked satellites in real-time with live position updates and connection status.
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader className="font-semibold">Flexible Scheduling</CardHeader>
          <CardBody>
            <p className="text-sm text-gray-400">
              Book satellite time from 15 minutes to 4 hours. Perfect for research, communications, and data collection.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
