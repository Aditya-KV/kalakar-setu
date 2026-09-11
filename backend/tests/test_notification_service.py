from unittest.mock import AsyncMock, patch

import pytest

from app.services import notification_service


@pytest.mark.asyncio
async def test_returns_false_without_a_token():
    assert await notification_service.send_push_notification(None, "Title", "Body") is False


@pytest.mark.asyncio
async def test_returns_false_for_a_non_expo_token():
    assert await notification_service.send_push_notification("some-other-token", "Title", "Body") is False


@pytest.mark.asyncio
async def test_returns_true_on_a_successful_send():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = lambda: {"data": {"status": "ok"}}
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        result = await notification_service.send_push_notification(
            "ExponentPushToken[abc123]", "Title", "Body", data={"type": "order"}
        )
    assert result is True


@pytest.mark.asyncio
async def test_returns_false_on_expo_ticket_error():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = lambda: {"data": {"status": "error", "message": "DeviceNotRegistered"}}
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        result = await notification_service.send_push_notification("ExponentPushToken[abc123]", "Title", "Body")
    assert result is False


@pytest.mark.asyncio
async def test_returns_false_on_non_200_response():
    mock_response = AsyncMock()
    mock_response.status_code = 500
    mock_response.text = "server error"
    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_response)):
        result = await notification_service.send_push_notification("ExponentPushToken[abc123]", "Title", "Body")
    assert result is False


@pytest.mark.asyncio
async def test_never_raises_on_network_exception():
    with patch("httpx.AsyncClient.post", AsyncMock(side_effect=RuntimeError("network down"))):
        result = await notification_service.send_push_notification("ExponentPushToken[abc123]", "Title", "Body")
    assert result is False
